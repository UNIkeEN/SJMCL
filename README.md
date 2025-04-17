## SJMC Launcher

SJMCL is an open-source Minecraft launcher from [Shanghai Jiao Tong University Minecraft Club (SJMC)](https://mc.sjtu.cn/welcome/content/3/).

### Development and Contributing

To get started, clone the repository and install the required dependencies:

```bash
git clone git@github.com:UNIkeEN/SJMCL.git
npm install
```

To run the project in development mode:

```bash
npm run tauri dev
```

We warmly invite contributions from everyone. 

* Before you get started, please take a moment to review our [Contributing Guide](https://github.com/UNIkeEN/SJMCL/blob/main/CONTRIBUTING.md) (includes more details on the development workflow). 
* Feel free to share your ideas through [Pull Requests](https://github.com/UNIkeEN/SJMCL/pulls) or [GitHub Issues](https://github.com/UNIkeEN/SJMCL/issues).

### Copyright

Copyright © 2024-2025 SJMCL Team.

> NOT AN OFFICIAL MINECRAFT SERVICE. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

The software is distributed under [GNU General Public License v3.0](/LICENSE).

By GPLv3 License term 7, we require that when you distribute a modified version of the software, you must obey GPLv3 License as well as the following [additional terms](/LICENSE.EXTRA): 

1. Use a different software name than SJMCL or SJMC Launcher;
2. Do not remove the function of sending user statisitics to our statisitics server (`src-tauri/src/utils/sys_info.rs`), and send only version numbers with prefix (more than two letters, e.g. `XX-0.0.1`).
3. Mark clearly in your repository README file, your distribution website or thread, Support documents, About Page in the software that you program is based on SJMCL and give out the url of the origin repository.
