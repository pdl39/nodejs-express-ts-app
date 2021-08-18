#!/usr/bin/env node

'use strict';

const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const TERM_COLORS = require('./termColors');

// This is the root directory and package.json of this original repo.
const repoRoot = path.resolve(__dirname, '../'); // make sure to change the second argument as needed.
const packagejson = require(path.resolve(repoRoot, 'package.json'));
const repo = packagejson.repository.url;


// Files to skip when calling copyFiles function (all in lower case).
const dirsToSkip = ['.git', '.cache', 'node_modules', 'dist', 'bin', 'temp'];
const filesToSkip = ['changelog.md', 'license', 'license.md', 'readme.md', 'package.json', 'package-lock.json', '.gitignore'];
const extToSkipAlways = ['.ds_store'];
const extToSkipConditional = ['.js', '.js.map', '.d.ts'];
const extSkipExceptionDirs = ['src', 'server']; // Directories in this list are exceptions for skipping certain extensions.


// If no argument is entered for project name, display a use case example.
if (process.argv.length < 3) {
  logError(`Please provide a name for your project.`, 'red');
  logError(`Use case example: `, 'gray');
  logError(`    npx ${packagejson.name} my-app`, 'gray');
  process.exit(1);
}


// process.cwd() is used to identify the current working directory of the user's project.
// (to be differentiated from the oritinal repo's root directory, which was identified above with __dirname)
const cwd = fs.realpathSync(process.cwd());
const appName = process.argv[2];
const appPath = path.resolve(cwd, appName);

// FOR LOCAL TESTING:
// const cwd = '/Users/pdl39/projects/npxBuildTest';
// const appName = 'new-app';
// const appPath = path.resolve(cwd, appName);

const appNameColored = `${TERM_COLORS.blue}<${appName}>${TERM_COLORS.reset}`;

// Setup User Project
setupProject();


/* ------------------------------------------------------- */


async function setupProject() {
  try {
    logMessage(`Initializing project ${appNameColored} at ${cwd}...`);

    // Create new project directory (appPath)
    try {
      makeAppDir();
    }
    catch (err) {
      throw err;
    }

    // npm init
    logMessage(`Running npm init...`);
    try {
      await runCommand(`cd ${appPath} && npm init -y`);
      logMessage(`npm init success!\n`, 'cyan');
    }
    catch (err) {
      logError(`npm init Failed.\n Please make sure you have npm installed.\n`, 'red');
      throw err;
    }

    // Copy all files from origin repo to user's project directory.
    // This excludes .gitignore & package.json/package-lock.json (which will be added later).
    logMessage(`Copying project files from ${repo}...`);
    try {
      await copyFiles(repoRoot, appPath);
      logMessage(`Successully created initial project files.\n`, 'cyan');
    }
    catch (err) {
      logError(err, 'red');
      throw err;
    }

    // Overwrite package.json created from npm init with new package.json.
    logMessage(`Rewriting package.json for ${appNameColored}...`);
    try {
      await overwritePackageJson();
      logMessage(`package.json rewrite success!`, 'cyan');
    }
    catch (err) {
      logError(err, 'red');
      throw err;
    }

    // Run 'git init' and copy .gitignore into user's project.
    logMessage(`Initializing git for ${appNameColored}...`);
    try {
      await runCommand(`cd ${appPath} && git init`);
      await copyFile(`${repoRoot}/temp`, appPath, `gitignore.txt`, `.gitignore`);
      logMessage(`git init success!\n`, 'cyan');
    }
    catch (err) {
      logError(err, 'red');
      throw err;
    }

    logMessage(`Installation Success.\n`, 'green');
    logMessage(`Please refer to README.md at ${repo} on how to get started.\n`, 'green');
    logMessage(`${packagejson.name} v${packagejson.version}`, 'gray');
    logMessage(`Published at npm (https://www.npmjs.com/package/${packagejson.name})`, 'gray');
    logMessage(`${packagejson.license} Licence`, 'gray');
    logMessage(`Copyright (c) ${new Date().getFullYear()} Peter Donghun Lee\n`, 'gray');
    logMessage(`Happy Coding :)`, 'brightGreen');
  }
  catch (err) {
    logError('Installation Failed.', 'brightRed');
    process.exit(1);
  }
};

// Reusable logging functions with color
function logMessage(message, color = null) {
  if (!color) {
    console.log(message);
  }
  else {
    console.log(`${TERM_COLORS[color]} ${message} ${TERM_COLORS.reset}`);
  }
};

function logError(message, color = null) {
  if (!color) {
    console.error(message);
  }
  else {
    console.error(`${TERM_COLORS[color]} ${message} ${TERM_COLORS.reset}`);
  }
};

// Helper function to be used to run exec commands.
async function runCommand(command) {
  try {
    const { stdout, stderr } = await exec(command);
    logMessage(stdout);
    logError(stderr, 'red');
  }
  catch (err) {
    throw err;
  }
};

// Check to see if the entered project name already exists in the current directory.
function makeAppDir() {
  try {
    fs.mkdirSync(appPath);
    logMessage(`Succeessfully created ${appNameColored}`, 'cyan');
    logMessage(`at ${cwd}\n`, 'cyan');
  }
  catch (err) {
    if (err.code === 'EEXIST') {
      logError(`${appNameColored} already exists.\nPlease choose a different name.`, 'magenta');
    }
    else {
      logError(err, 'red');
    }
    throw err;
  }
};

// Copy a single file from source directory to a destination directory.
// If destFileName is not entered, destination file name will be same as source file name.
function copyFile(srcDir, destDir, srcFileName, destFileName = null) {
  // Using fs.create[Read/Write]Stream() can be more performant vs. fs.[read/write]File()
  try {
    const destFileN = destFileName || srcFileName;
    const srcFile = fs.createReadStream(path.resolve(srcDir, srcFileName));
    const destFile = fs.createWriteStream(path.resolve(destDir, destFileN));
    srcFile.on('open', function () {
      srcFile.pipe(destFile);
    });
    srcFile.on('error', function (err) {
      throw err;
    });
  }
  catch (err) {
    logError(err, 'red');
  }
};

// Recursive function to be used to copy all required files and subdirectories(recursive) from the original repo to the user's new project repo.
async function copyFiles(srcDir, destDir, extSkipExcepDir = null) {
  try {
    const dirEntries = await fsPromises.readdir(srcDir, { withFileTypes: true });

    for (const dirEntry of dirEntries) {
      // skip any files/directories that need to be skipped.
      if (dirsToSkip.includes(dirEntry.name.toLowerCase())) continue;
      if (filesToSkip.includes(dirEntry.name.toLowerCase())) continue;

      // If dirEntry is a file, copy the file to user's project directory.
      if (dirEntry.isFile()) {
        // If the file has an extension that should not be copied, skip.
        const fileNameSplit = dirEntry.name.split('.');
        const fileExt1 = '.' + fileNameSplit[fileNameSplit.length - 1];
        const fileExt2 = '.' + fileNameSplit.slice(-2).join('.').toLowerCase();

        if (extToSkipAlways.includes(fileExt1)) continue;
        // If srcDir is not the origial repo root
        // and if the current directory is not inside an ancestor directory that is an exception directory,
        // skip any files with extensions to be skipped.
        if (srcDir !== repoRoot && !extSkipExcepDir) {
          if (extToSkipConditional.includes(fileExt1) ||
            extToSkipConditional.includes(fileExt2)
          ) continue;
        }

        // Copy files from original repo to user's project directory.
        copyFile(srcDir, destDir, dirEntry.name);
      }

      // If dirEntry is a (sub)directory, recursively call copyNecessaryFiles on the subdirectory.
      else if (dirEntry.isDirectory()) {
        const srcSubDir = path.resolve(srcDir, dirEntry.name);
        const destSubDir = path.resolve(destDir, dirEntry.name);
        fs.mkdirSync(destSubDir);

        // If current directory is an exception directory,
        // prepare to pass it down as the 3rd argument in recursive call.
        let newExtSkipExcepDir = null;
        if (extSkipExceptionDirs.includes(dirEntry.name)) {
          newExtSkipExcepDir = dirEntry.name;
        }

        try {
          // If current recursive call has an exception directory passed down from a previous call,
          // continue to pass it down.
          // Will not await copyFiles calls so that we can copy all files asynchronously
          if (extSkipExcepDir) {
            copyFiles(srcSubDir, destSubDir, extSkipExcepDir);
          }
          else if (newExtSkipExcepDir) {
            copyFiles(srcSubDir, destSubDir, newExtSkipExcepDir);
          }
          else {
            copyFiles(srcSubDir, destSubDir);
          }
        }
        catch (err) {
          logError(err, red);
        }
      }
    }
  }
  catch (err) {
    throw err;
  }
};

function generateNewPackageJson() {
  const scripts = JSON.stringify(packagejson.scripts).split(',').join(',\n    ').slice(1, -1);
  const deps = JSON.stringify(packagejson.dependencies).split(',').join(',\n    ').slice(1, -1);
  const devDeps = JSON.stringify(packagejson.devDependencies).split(',').join(',\n    ').slice(1, -1);
  const engines = JSON.stringify(packagejson.engines).split(',').join(',\n    ').slice(1, -1);

  return `{
  "name": "${appName}",
  "version": "1.0.0",
  "description": "",
  "author": "",
  "license": "ISC",
  "keywords": [],
  "main": "${packagejson.main}",
  "scripts": {
    ${scripts}
  },
  "html": "${packagejson.html}",
  "fallback": "${packagejson.fallback}",
  "src": "${packagejson.src}",
  "assets": "${packagejson.assets}",
  "favicon": "${packagejson.favicon}",
  "dependencies": {
    ${deps}
  },
  "devDependencies": {
    ${devDeps}
  },
  "engines": {
    ${engines}
  }
}`;
};

async function overwritePackageJson() {
  try {
    const newPackageJson = generateNewPackageJson();
    const projectPackageJsonUrl = path.resolve(appPath, 'package.json');

    await fsPromises.writeFile(
      projectPackageJsonUrl,
      newPackageJson
    );
    logMessage(`Wrote to ${projectPackageJsonUrl}:\n${newPackageJson}`, 'cyan');
  }
  catch (err) {
    logError(err.stack, 'magenta');
    logError(`package.json overwrite failed.`, 'red');
    throw err;
  }
};
