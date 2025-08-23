**English** · [简体中文](docs/CHANGELOG.zh-Hans.md)

SJMCL follows [Semantic Versioning 2.0.0](http://semver.org/).

## 0.2.0

`2025-08-22`

- 🔥 **Support import and install modpacks. #792** @Reqwey @UNIkeEN 
- 🔥 **Auto-download the Fabric API mod when creating an instance with Fabric. #844** @SundayChen
- 🌟 Support launching the game directly into a save (quick singleplayer). #788 @baiyuansjtu 
- 🌟 Support launching the older version game directly into a server (quick multiplayer). @UNIkeEN  
- 🌟 Add prompt for required dependencies when downloading mods. #794 @SundayChen
- 🌟 Add BellSoft vendor support in Java download modal. #806 @baiyuansjtu 
- 🌟 Add a simple feature tour for new users. #821 @UNIkeEN
- 🌟 Add more crash analysis match according to the crashmc website. #826 @itray25 
- 🌟 Optimize UI/UX in creating instances, mod updating and resource downloading. @itray25 @SundayChen 
- 🐛 Fix issue of filtering wrong version in resource download modal, fallback to all versions. #790 @SundayChen 
- 🐛 Fix launch error due to duplicated classpath. @Reqwey 
- 🐛 Fix quick routing error of the launch button due to missing encoded instance ID. #795 @UNIkeEN 
- 🐛 Fix sorting error in screenshot and world list page, auto-refresh screenshots when the page is mounted. @UNIkeEN
- 🐛 Fix error in recording playtime. #815 @UNIkeEN 
- 🐛 Fix issue where custom game window title had no effect on Windows. #827 @ModistAndrew 
- 🐛 Fix issue of failing to join a server due to an outdated account access token. #846 @Reqwey
- ⚡️ Avoid unnecessary fallback cache fetching in version comparisons. #799 @UNIkeEN
- ⚡️ Use futures to concurrently speed up game file validation. #819 #836 @xunying123
- 💄 Refactor code for better style and improved maintainability.
- 📦 Use the newly designed volume icon for DMG installer. @Neuteria 
- 📦 Update Tauri core dependencies and plugins.
- Workflow:
   - Fix version string in nightly release workflow. #791 @Minecrafter-Pythoner 
   - Generate changelog draft from commit messages to release note. #793 @pangbo13 
   - Add permissions to GitHub Actions workflow files. #817 @Minecrafter-Pythoner 

## 0.1.1

`2025-08-01`

- 🌟 Add support for HMCL's custom JVM argument `primary_jar_name`. #756 @Reqwey  
- 🌟 Include the full launch command in the exported crash report. #775 @UNIkeEN  
- 🌟 Add a quick link on the launch page to directly access instance settings. #777 @UNIkeEN  
- 🐛 Fix connection failure when searching CurseForge resources. 
- 🐛 Fix routing errors and instance summary retrieval failure after deleting an instance. #758 @UNIkeEN  
- 🐛 Fix error window appearing when a launch is manually cancelled. #761 @Reqwey  
- 🐛 Fix text wrapping issue in the instance basic info section. #766 @UNIkeEN  
- 🐛 Fix Java list not refreshing before each game launch. #772 @UNIkeEN  
- 🐛 Fix background image cache not updating when uploading files with the same name. #776 @baiyuansjtu  
- 🐛 Fix incorrect working directory in the launch command. #778 @xunying123  
- 🐛 Fix UX issues in resource downloading; matching versions will now auto-expand. #783 @UNIkeEN  
- 🛠 Move game log files to a dedicated cache folder. #765 @UNIkeEN  
- 🛠 In portable distributions, launcher configuration files and predefined game directories now reside in the current directory. #779 @UNIkeEN