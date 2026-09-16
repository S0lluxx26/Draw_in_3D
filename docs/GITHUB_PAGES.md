# GitHub repository and HTTPS web app

The public repository and GitHub Pages site use the same account as the reference project. Publishing was authorized on 16 September 2026. The workflow deploys each successful main-branch build automatically.

Repository: [S0lluxx26/Draw_in_3D](https://github.com/S0lluxx26/Draw_in_3D)

Web app: [Draw in 3D](https://s0lluxx26.github.io/Draw_in_3D/)

This is a project site on the same GitHub account as `Project_web_student_support`. The source includes the native Android project and browser editor. The website serves only the generated `web/dist` directory, including the synthetic starter scene and local Three.js files. Local SDK configuration, build caches, installed dependencies, generated APKs, test output and SSH credentials are excluded from Git.

## Publishing updates

The local repository uses this SSH origin:

```text
git@github.com:S0lluxx26/Draw_in_3D.git
```

Push a commit to `main` to run `.github/workflows/pages.yml`. It installs locked web dependencies, runs the focused web checks, builds the static editor, then deploys the artifact to GitHub Pages. Pull requests run checks/build only. The deployment job has Pages write and OIDC permissions; builds have repository read permission. Official actions are pinned to verified commit SHAs.

In GitHub repository **Settings → Pages**, the source is **GitHub Actions**. A workflow can also be started from **Actions → Build and publish web app → Run workflow**. Failed builds do not replace the last successful website. [GitHub's custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The app uses relative asset and import paths, so it works beneath `/Draw_in_3D/`. No Node server runs on GitHub Pages. Node is needed only to build the site or run the optional local preview.

## Open on a phone

Open the HTTPS web app URL in the phone's browser. Touch drawing and project import/export use the same client-side editor. Export before closing or refreshing; the web prototype does not autosave or sync between devices. Project files and pictures selected by the user are processed in the browser and are not uploaded by the app. Browser/WebGL/device compatibility still needs physical S9+ and S22 Ultra review.

HTTPS supplies the secure context needed by browser sensor APIs, but publishing does not itself add sensor handling. This version's web editor has no Gyro Look or Camera AR mode yet. Gyro and AR remain available in the native Android prototype. See the [web contract](WEB_INTEROP.md) for the current scope.

The prepared Android APK and downloadable runtime ZIPs are local build artifacts, not source files or Pages downloads. Build Android using the root README instructions. A GitHub release can distribute those artifacts separately when needed.
