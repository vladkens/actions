# windows-installer

Builds a per-user Windows installer with Inno Setup (preinstalled on the hosted Windows runners)
for each of an app's exes, one per architecture: `<name>-dev-windows-<arch>-setup.exe`, renamed
by rust-publish on a release.

- Installs for the current user, with no administrator, into `%LOCALAPPDATA%\Programs\<name>`:
  the exe, a Start menu entry, and Settings › Apps' entry with the version and the uninstaller.
- Always the same folder, so an app's own updater can run a newer installer over it:
  `setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART` installs it, exits 0 on success and
  starts nothing; the updater starts the app.
- An interactive install over a running copy closes it through Restart Manager and offers to
  start the app at the end.
- The uninstall removes the files, the Start menu entry and, with `autostart`, the app's launch
  at login. The app's own data stays.
- Not signed: SmartScreen warns once at the first download.

Inputs and outputs: [action.yml](action.yml). Runs on a Windows runner after the exes are
built; needs no permissions.

```yaml
- uses: vladkens/actions/windows-installer@v1
  with:
    name: Wavo
    id: 4f1c2b0e-6d5a-4c8e-9b7a-2e3d4f5a6b7c # a GUID of the app's own, never changed
    exe: |
      x64=target/x86_64-pc-windows-msvc/dist/wavo-app.exe
      arm64=target/aarch64-pc-windows-msvc/dist/wavo-app.exe
    license: LICENSE
    autostart: me.vladkens.wavo
```
