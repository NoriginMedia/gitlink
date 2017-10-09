let colors = require('colors');
const path = require('path');
const projectRoot = process.cwd();
const fs = require("fs");
const simpleGit = require('simple-git');
const del = require('del');
const argv = require('yargs').argv;
const canSymlink = require('can-symlink');
const link = require('fs-symlink');

if(canSymlink()) {
	let linkConig = argv.config || './git.link.json';
	let absoluteConfigPath = path.join(projectRoot, linkConig);
	if (!fs.existsSync(absoluteConfigPath)) {
		return console.error("GitLink Error: No file found at: ".red + absoluteConfigPath.yellow);
	}

	console.log("--------------".blue);
	console.log("|".blue + " GitLinking ".blue + "| ".blue);
	console.log("--------------".blue);
	let gitPackages = require(absoluteConfigPath);
	for(let name in gitPackages) {
		let linkInfo = gitPackages[name];
		isLocalLink(linkInfo).then(()=> {
			isLocalRepoValid(linkInfo).then(()=> {
				createLink(linkInfo).then(()=> {
					console.log(
						"Linking of package: ".blue + linkInfo["name"].green + " from ".blue +
						linkInfo["paths"]["localLinkPath"].green + " successful".blue
					);
				}).catch((err)=>{
					//console.error();
				});
			}).catch((err)=>{
				console.error(err);
			});
		}).catch((err)=>{
			console.error(err);
			clonePackageRepo(linkInfo);
		});
	}
} else {
	console.error("GitLink Error. GitLink is unable to create symlinks in the current environment. ".red +
		"It is likely that User/System permissions must be changed to allow GitLink to continue.".red);
}

function createLink(linkInfo) {
	return new Promise((fulfill, reject) => {
		let absoluteLocalLinkPath = path.join(projectRoot, linkInfo["paths"]["localLinkPath"]);
		let absoluteTargetPath = path.join(projectRoot, linkInfo["paths"]["targetPath"]);
		let absoluteRepoPath = path.join(absoluteTargetPath, linkInfo["name"]);
		return del([absoluteRepoPath]).then(()=> {
			link(absoluteLocalLinkPath, absoluteRepoPath, 'junction').then(function () {
				fulfill();
			}).catch(() => {
				reject();
			});
		});
	});
}

function isLocalLink (linkInfo) {
	return new Promise((fulfill, reject) => {
		let useLocalLink = linkInfo["options"] ? linkInfo["options"]["useLocalLink"] : false;
		let localLinkPath = linkInfo["paths"] ? linkInfo["paths"]["localLinkPath"] : false;
		if(useLocalLink && !localLinkPath) {
			reject("GitLink configuration for: ".yellow + linkInfo["name"].green + " has 'useLocalLink' value but no 'localLinkPath' defined.".yellow);
		}
		if(!useLocalLink || !localLinkPath) {
			reject("");
		}
		if (useLocalLink && localLinkPath && typeof localLinkPath !== "string") {
			reject("Error in GitLink config 'localLinkPath' is not correctly defined for: ".red + linkInfo["repository"].toString().green);
		}
		fulfill();
	});
}

function isLocalRepoValid(linkInfo) {
	return new Promise((fulfill, reject) => {
		console.log("Attempting to create symlink for git package: ".blue + linkInfo["name"].green);
		let absoluteLocalLinkPath = path.join(projectRoot, linkInfo["paths"]["localLinkPath"]);
		if(!fs.existsSync(absoluteLocalLinkPath)) {
			reject("Error in GitLink config : ".red + absoluteLocalLinkPath.green + "cannot be reached or doesn't exist".red);
		}
		let localRepo = require('simple-git')(absoluteLocalLinkPath);
		localRepo.listRemote(['--get-url'], function (err, data) {
			if (err) {
				reject("No remote git repository found at ".red + absoluteLocalLinkPath.green);
			} else {
				if (data && removeWhitespace(data) !== removeWhitespace(linkInfo["repository"])) {
					reject("Remote URL: ".red + data.toString().green +
						"Does not match: ".red + linkInfo["repository"].toString().green);
				}
				if (linkInfo["tag"] && linkInfo["branch"]) {
					reject("Both TAG and BRANCH IDs are defined for: ".red + linkInfo["name"].green + " only a single ID is allow".red);
				}
				let versionId = linkInfo["branch"] || linkInfo["tag"];
				if (versionId) {
					isTagOrBranchMatching(linkInfo, versionId, localRepo).then(()=>{
						fulfill();
					}).catch((err)=>{
						console.error(err);
					});
				} else {
					fulfill();
				}
			}
		});
	})
}

function removeWhitespace(string) {
	return string.replace(/\s/g, "");
}

function isTagOrBranchMatching(linkInfo, versionId, localRepo) {
	return new Promise((fulfill, reject) => {
		localRepo.branchLocal((err, data) => {
			if (err) {
				reject("Error occurred attempting to check the local branch in location: ".red + linkInfo["paths"]["localLinkPath"]);
			}
			if(data.detached) {
				console.warn(
					"Warning local GitLink repo: ".yellow + linkInfo["repository"].toString().green +
					" HEAD is detached with label: ".yellow + data.current.green
				);
			}
			if(data.current !== versionId){
				reject("Error mismatched TAG or BRANCH ID for GitLink: ".red + linkInfo["name"].green + ".".red +
					" Local branch: ".red + data.current.green + " does not match: ".red + versionId.green + " in config.".red);
			} else {
				console.log(
					"Branch match found: ".blue + data.current.green + " for GitLink: ".blue + linkInfo["name"].green
				);
				fulfill(data.current);
			}
		});
	});

}

let clonePackageRepo = function(linkInfo) {
	let repoName = linkInfo["name"];
	let remote = linkInfo["repository"]
	let id= (linkInfo["branch"] || linkInfo["tag"] || "master");
	let absoluteTargetPath = path.join(projectRoot, linkInfo["paths"]["targetPath"]);
	let absoluteRepoPath = path.join(absoluteTargetPath, repoName);

	return del([absoluteRepoPath]).then(()=>{
		simpleGit(projectRoot)
			.clone(remote, absoluteRepoPath)
			.exec(function() {
				let tempGitContent = require('simple-git')(absoluteRepoPath);
				tempGitContent.checkout(id).exec(()=> {
					console.log('Cloning & checkout of '.magenta + repoName.yellow + ' : ' + id.yellow + ' successful'.magenta);
					stripGitFolder(absoluteRepoPath).then(()=>{
						console.log("Prepping of cloned package: ".magenta + repoName.yellow + ' successful'.magenta);
					});
				})/*.catch((err)=>{
					console.error("Failed to checkout branch / tag: ".red + id.yellow + ". For package: ".red + repoName.yellow)
				});*/
			})
	}).catch((err)=>{
		console.error(err);
	});
};

let stripGitFolder = function(repoPath) {
	return del(path.join(repoPath, './.git'));
};
