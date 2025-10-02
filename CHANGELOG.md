**English** · [简体中文](docs/CHANGELOG.zh-Hans.md)

SJMCL follows [Semantic Versioning 2.0.0](http://semver.org/).

## 0.4.2

`2025-09-30`

**This update provides important security updates. All users are strongly recommended to install it.**

- 🐛 Fix display issues in instance settings and resource list pages. #952 @1357310795
- 🐛 Fix the issue where some third-party authentication sources could not log in with a password. #956 @Reqwey
- 🐛 Fix text display issue on the launch screen when character names are too long. #957 @UNIkeEN
- 🐛 Optimize account storage format to avoid potential security issues. #962 @Reqwey @hans362
- 🐛 Fix display issue in the mod info dialog and improve information display in resource version list. #964 @SundayChen @UNIkeEN
- 🐛 Fix the issue where version lists of some resources from Modrinth could not be displayed properly. #968 @SundayChen
- 🐛 Disable "check mod updates" button when the local mod list is empty. #977 @SundayChen
- 💄 Refactor part of the codebase to improve style and maintainability. #935 #964 @baiyuansjtu @SundayChen
- Docs:
   - Update additional terms of the open source license. #960 @ff98sha

## 0.4.1

`2025-09-27`

- 🐛 Fix the issue where the Java page cannot load properly. @UNIkeEN

## 0.4.0

`2025-09-27`

- 🔥 Support auto-update of the launcher itself. #918 #934 @UNIkeEN @hans362
- 🔥 Support downloading multiple versions of Java runtime from Mojang source. #926 @Nova-Squ1 @UNIkeEN
- 🌟 Add one-click action in settings page to reveal and edit the raw JSON config file in file explorer. #928 @UNIkeEN
- 🌟 Complete the logic for advanced game launch options. #929 @xunying123
- 🐛 Fix missing close button in mod info dialog. #921 @SundayChen
- 🐛 Fix routing error when switching between instance detail pages. #942 @UNIkeEN
- 🐛 Fix text overflow issue in instance detail, resource download and other pages under specific scenarios. #950 @1357310795
- ⚡️ Avoid redundant version number fetching logic during main process startup. #937 @ModistAndrew
- 📦 Remove unused Microsoft client secret environment variable. #949 @Reqwey
- Web & Docs:
   - Update the additional terms of the open source license. #945 @UNIkeEN @ff98sha
   - Add download pages for latest and historical versions on the website. @itray25 @xunying123
- Workflow:
   - Fix missing `rustfmt` component and `i686-pc-windows-msvc` target in build workflow. @UNIkeEN

## 0.3.3

`2025-09-21`

- 🌟 Support automatic detection of the Java runtime downloaded by PCL. #916 @Nova-Squ1
- 🐛 Fix crash when the configured download cache directory has no write permission. #913 @Nova-Squ1
- 💄 Refactor code for better style and improved maintainability. #908 @w1049
- 🛠 The mod list no longer shows unpackaged mods in non-development mode. #915 @UNIkeEN

## 0.3.2

`2025-09-17`

- 🌟 Add zh-Hans translation for local mod names and resource descriptions. #888 @SundayChen  
- 🌟 Support detection of mod loaders in instances created by PCL. #889 @xunying123  
- 🌟 Support deleting local mods in the mod list page. #895 @KiloxGo  
- 🌟 Add screenshot sharing feature on macOS, providing an experience similar to Finder. #903 @UNIkeEN  
- 🌟 When the launcher language is zh-Hans, allow skipping accessibility options and automatically set the instance language after creation. #907 @UNIkeEN  
- 🐛 Fix issue where canceling player selection when logging into third-party authentication sources made it impossible to add players again. #892 @Reqwey  
- 🐛 Fix issue where operations such as refreshing the instance list were not triggered after completing download tasks with retries. #893 @Reqwey  
- 🐛 Fix issue of incomplete downloads of legacy Forge libraries. #896 @Reqwey  
- 🐛 Fix issue where access tokens in launch commands were not masked when exporting crash reports. #910 @Reqwey  
- 🛠 The default file name of downloaded mod resources now includes possible zh-Hans translations. #888 @SundayChen  
- 🛠 Editable fields such as instance settings now auto-save when losing focus. #888 @SundayChen  
- 📦 Adjust the default game directory in development mode to be alongside the build artifacts. 

## 0.3.1

`2025-09-13`

- 🐛 Fix issue of possible incompleteness in device authorization response and account profile during the login flow. #875 @Reqwey
- 🐛 Fix issue of incomplete player information when logging in to third-party authentication sources through OAuth (Ygg Connect proposal). #882 @Reqwey
- 🐛 Fix the issue of possible invalid access token when logging in to third-party authentication sources with email and password. #885 @Reqwey
- 🛠 Refactor system utility functions into a service class. #883 @baiyuansjtu
- 📦 Use the new built-in background image of the SJTU east gate. @UNIkeEN @GNWork
- Workflow:
   - Auto upload release artifacts to the SJMC server. #880 @Minecrafter-Pythoner @hans362

## 0.3.0

`2025-09-05`

- 🔥 **Add mod name's zh-Hans translation on the download page, support zh-Hans search queries. #851** @SundayChen @UNIkeEN
- 🌟 Add zh-Hans translation for resource descriptions. #851 @SundayChen
- 🌟 Support external link to the MCMod page from the mod info modal. #851 @SundayChen
- 🌟 Support the Windows Arm64 platform. #867 @Minecrafter-Pythoner
- 🐛 Fix issue of token refreshing in config synchronization. #852 @Nova-Squ1
- 🐛 FIx issue of duplicate launch arguments caused by retrying mod loader downloads. #860 @Reqwey
- 📦 Update the dependency next to the latest version. #869 @dependabot[bot]
- Workflow:
   - Synchronize the npm and pnpm lock files of frontend. #861 #862 @pangbo13 @Minecrafter-Pythoner

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