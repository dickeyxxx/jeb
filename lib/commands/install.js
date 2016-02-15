'use strict';

let Promise      = require('bluebird');
let dependencies = require('../dependencies');
let _            = require('lodash');
let registry     = require('../registry');
let config       = require('../config');
let path         = require('path');
let prune        = require('../prune');
let log          = require('../log');
let manifest     = require('../manifest');

function installPackages (tree, dir) {
  let gatherDependencies = (node, root) => {
    return _.flatMap(Array.from(node.entries()), pkg => {
      let dir = path.join(root, pkg[0]);
      return gatherDependencies(pkg[1].dependencies, path.join(dir, 'node_modules'))
      .concat({
        name: pkg[0],
        version: pkg[1].version,
        path: dir,
      });
    });
  };
  return Promise.map(gatherDependencies(tree, dir), pkg => {
    log(`installing ${pkg.name}`);
    return registry.fetchPackageTarball(pkg.name, pkg.version, pkg.path);
  }, {concurrency: 15});
}

function run (args) {
  let toInstall = _.reduce(args._.slice(1), (l, p) => {
    l[p] = null;
    return l;
  }, {});
  return manifest.project()
  .then(p => p.dependencies)
  .then(p => dependencies.get(_.merge(toInstall, p)))
  .then(tree => dependencies.dedupe(tree))
  .then(tree => {
    dependencies.print(tree);
    let dir = path.join(config.root(), 'node_modules');
    return installPackages(tree, dir)
    .then(() => prune(tree));
  });
}

module.exports = {
  run,
};
