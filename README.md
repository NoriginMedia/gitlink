# gitlink

A basic node package installer for Git repos.
---------------------------------------------

#Updated documentation coming soon.

Example GitLink Config.
./git.link.json

{
	"nmplayer": {
		"name": "nmplayer",
		"repository": "https://github.com/AspiroTV/module-player.git",
		"tag": "v0.0.3-beta.3",
		"options": {
			"useLocalLink": true
		},
		"paths": {
			"localLinkPath": "../module-player",
			"targetPath": "./git_packages"
		}
	}
}
