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

function isNewPackage(pkg, dir, toInstall) {
  let notSubmodule = pkg.path === path.join(dir, pkg.name);
  let notInstalled = !toInstall[pkg.name];
  if (notSubmodule, notInstalled) {return true; }
}

function addSemVer(deps, name, version) {
  // async write out to pkg.json?
  deps[name] = version;
}

function installPackages (tree, dir, toInstall) {
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
    let t = new log.Task(pkg.name, {verbose: 'installing'});
    if (isNewPackage(pkg, dir, toInstall)) {addSemVer(toInstall, pkg.name, pkg.version); }
    return registry.fetchPackageTarball(pkg.name, pkg.version, pkg.path)
    .then(() => t.done());
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
    return installPackages(tree, dir, toInstall)
    .then(() => prune(tree));
  });
}

module.exports = {
  run,
};
