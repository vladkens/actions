# macos-sign

Two steps. `sign` puts the Developer ID certificate into a keychain of the run's own and signs the `.app` in each zipped macOS release file, zipped again under the same name; its output `identity` (the SHA-1) signs what steps after it make, a disk image of the app say. `notarize` notarizes each file, a .zip or a .dmg, with an App Store Connect API key and staples the ticket (to a disk image itself, to the app in a zip), then deletes the keychain; `cleanup` with `if: always()` deletes it when a step failed before. The app's signature gets the hardened runtime, a secure timestamp and the entitlements file from the checkout: the artifact comes from a job where dependencies' build scripts ran, so nothing but its bytes is trusted. Without `certificate` or the API key (a fork, a pull request) the files stay as they are. It signs the bundle itself: nested code (helpers, frameworks) is signed by the app's own bundling, or notarization refuses it.

It never compiles: run it in a job of its own between rust-build and rust-publish, so no dependency's build script (or a process one left running) is where the certificate is. Keep the secrets in a GitHub Environment limited to the default branch, sign release commits only, and pin the job's actions by commit. Needs a macOS runner and no permissions.

Inputs: [action.yml](action.yml).

```yaml
  sign:
    # Release commits by the releaser only (`release: vX.Y.Z`, rust-publish's `releasers`); dev
    # builds stay ad hoc.
    if: >-
      github.event_name == 'push' && github.ref == 'refs/heads/main'
      && startsWith(github.event.head_commit.message, 'release: v')
      && github.triggering_actor == github.repository_owner
    needs: build
    runs-on: macos-latest
    environment: release
    steps:
      - uses: actions/checkout@<sha> # v7
        with:
          persist-credentials: false
      - uses: actions/download-artifact@<sha> # v8
        with:
          name: release # rust-build's `artifact`: the macOS build's, when each OS has its own
          path: target/distrib
      - id: sign
        uses: vladkens/actions/macos-sign@v1
        with:
          step: sign
          files: target/distrib/*-macos.zip
          entitlements: assets/app.entitlements
          required: true # a release is never unsigned
          certificate: ${{ secrets.APPLE_CERTIFICATE }} # base64 .p12
          certificate-password: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
      # Here a step may make a disk image of the signed app and sign it with
      # ${{ steps.sign.outputs.identity }}; notarize it then instead of the zip.
      - uses: vladkens/actions/macos-sign@v1
        with:
          step: notarize
          files: target/distrib/*-macos.zip
          required: true
          api-key: ${{ secrets.APPLE_API_KEY }} # the .p8's text
          api-key-id: ${{ secrets.APPLE_API_KEY_ID }}
          api-issuer: ${{ secrets.APPLE_API_ISSUER }}
      - if: always()
        uses: vladkens/actions/macos-sign@v1
        with:
          step: cleanup
      - uses: actions/upload-artifact@<sha> # v7
        with:
          name: release # the same name: rust-publish gets the signed files
          path: target/distrib/*
          overwrite: true

  publish:
    if: github.ref == 'refs/heads/main' && !failure() && !cancelled() # `sign` skipped is fine
    needs: [test, build, sign]
```

The certificate: a "Developer ID Application" one from developer.apple.com (Certificates, +), made from a CSR (`openssl req -new -newkey rsa:2048 -nodes -keyout key.pem -out request.csr -subj "/CN=…"`), and joined with its key into a .p12 (`openssl pkcs12 -export -legacy -inkey key.pem -in <cert>.pem -out id.p12`). The API key: App Store Connect, Users and Access, Integrations, Team Keys, role Developer.
