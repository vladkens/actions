# macos-sign

Signs the `.app` in each zipped macOS release file with a Developer ID, notarizes it with an App Store Connect API key and staples the ticket, then zips it again under the same name. The bundle's own entitlements stay; the signature gets the hardened runtime and a secure timestamp. Without `certificate` (a fork, a pull request) it leaves the files as they are; without the API key it signs and doesn't notarize.

It never compiles: run it in a job of its own between rust-build and rust-publish, so no dependency's build script runs where the certificate is. The certificate goes into a keychain of the run's own, deleted at the end. Needs a macOS runner and no permissions.

Inputs: [action.yml](action.yml).

```yaml
  sign:
    if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'
    needs: build
    runs-on: macos-latest
    steps:
      - uses: actions/download-artifact@v8
        with:
          name: release-macOS
          path: target/distrib
      - uses: vladkens/actions/macos-sign@v1
        with:
          certificate: ${{ secrets.APPLE_CERTIFICATE }} # base64 .p12
          certificate-password: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          api-key: ${{ secrets.APPLE_API_KEY }} # the .p8's text
          api-key-id: ${{ secrets.APPLE_API_KEY_ID }}
          api-issuer: ${{ secrets.APPLE_API_ISSUER }}
      - uses: actions/upload-artifact@v7
        with:
          name: release-macOS
          path: target/distrib/*
          overwrite: true
```

The certificate: a "Developer ID Application" one from developer.apple.com (Certificates, +), made from a CSR (`openssl req -new -newkey rsa:2048 -nodes -keyout key.pem -out request.csr -subj "/CN=…"`), and joined with its key into a .p12 (`openssl pkcs12 -export -legacy -inkey key.pem -in <cert>.pem -out id.p12`). The API key: App Store Connect, Users and Access, Integrations, Team Keys, role Developer.
