# Code signing policy

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

This policy applies to official Windows releases (the application executable, NSIS installer, and portable executable) built from the [UNIkeEN/SJMCL](https://github.com/UNIkeEN/SJMCL) repository.

## Team roles

- **Committers and reviewers:** [SJMC-Dev](https://github.com/SJMC-Dev) (external contributions via pull requests are reviewed and merged by project maintainers).
- **Approvers:** [UNIkeEN](https://github.com/UNIkeEN), [pangbo13](https://github.com/pangbo13)

## Signing process

- Only Windows binaries built automatically from this repository via GitHub Actions are submitted for signing; local or unverified builds are never signed with the project certificate.
- Every production signing request requires manual review and approval by an Approver in SignPath.
- Certificate private keys are managed by SignPath and are not directly accessible to team members.
- Any bundled third-party components retain their original signatures and are not re-signed by SJMCL.

## Privacy policy

See the [Privacy Statement](https://mc.sjtu.cn/sjmcl/en/docs/tos.html#v-privacy-statement) in the SJMCL Terms of Service for details on data handled by SJMCL itself.

When you use online features such as account sign-in or resource downloads, SJMCL connects to the corresponding services, which are governed by their own privacy policies—including [Microsoft](https://privacy.microsoft.com/privacystatement), [CurseForge](https://www.curseforge.com/privacy-policy), and [Modrinth](https://modrinth.com/legal/privacy), as well as any third-party authentication servers, download mirrors, or extensions you choose to configure.

## Contact

For questions about this policy or a signed SJMCL release, contact [launcher@sjmc.club](mailto:launcher@sjmc.club).
