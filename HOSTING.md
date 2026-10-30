# Hosting on GitHub Pages

Use GitHub Pages to build and publish the site automatically whenever you push to `main`. A normal project repository named `multiplicative-weights` will have this address:

```text
https://YOUR_USERNAME.github.io/multiplicative-weights/
```

Replace `YOUR_USERNAME` everywhere below with the GitHub account that owns the repository. If you choose a different repository name, replace `multiplicative-weights` in the URL and Astro's `base` setting too. This URL structure is GitHub's standard for project sites. [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

This guide does not itself publish anything. Follow the steps below to configure hosting.

## 1. Put this repository on GitHub

Create an **empty public repository** named `multiplicative-weights` on GitHub. Leave the options for an initial README, license, and `.gitignore` unselected because this local repository already has files and Git history. Public repositories support Pages on GitHub Free. [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

Run all commands from the website's Git repository root:

```bash
cd /home/sreeram/cmu/f26/15455/project/multiplicative-weights
git status --short
```

Review the listed changes, then commit your current site and this guide:

```bash
git add .
git commit -m "Add website source"
```

If everything is already committed, skip those two commands. Connect the repository and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/multiplicative-weights.git
git push -u origin main
```

The local branch is already named `main`. Use your usual GitHub authentication when pushing. If you have connected a remote since this guide was written, check `git remote -v` and reuse it rather than adding `origin` again.

Only this directory is the repository: its GitHub root should contain `package.json`, `astro.config.mjs`, and `src/`. Do not upload the personal parent workspace or nest the website inside another `multiplicative-weights/` directory on GitHub.

## 2. Enable GitHub Actions as the publishing source

In the GitHub repository, open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**. The workflow in step 4 supplies the generated site. [GitHub custom publishing workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## 3. Set the site's public address in Astro

In `astro.config.mjs`, add these two properties inside the existing `defineConfig({ ... })` object, alongside `output` and `integrations`:

```js
site: 'https://YOUR_USERNAME.github.io',
base: '/multiplicative-weights',
```

Keep the existing Svelte, MDX, and math configuration. `site` is the account's origin; `base` is the repository path. Astro uses these settings when generating the deployed site's URLs. [Astro's GitHub Pages configuration](https://docs.astro.build/en/guides/deploy/github/).

This project's navigation and public-asset links already use `sitePath()` from `src/lib/paths.ts`, which accounts for `base`. Use that helper for future site-local links as well.

## 4. Add the deployment workflow

Create the workflow directory:

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/deploy.yml` with the following complete contents:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: github-pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out source
        uses: actions/checkout@v7

      - name: Install, check, build, and upload
        uses: withastro/action@v6
        with:
          path: .
          node-version: 24
          build-cmd: npm run build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy site
        id: deployment
        uses: actions/deploy-pages@v5
```

This uses Astro's maintained action, with the action versions listed in its current deployment example. It detects npm from `package-lock.json`, installs dependencies, runs the project's build script, and uploads `dist/`. The separate deploy job publishes that artifact. [Astro action documentation](https://github.com/withastro/action).

Keep `path: .`: the Astro project is at the Git repository root. Node 24 satisfies this project's Node requirement. `npm run build` includes the existing Astro, TypeScript, and Svelte checks. Commit `package-lock.json` along with your source; keep generated `dist/` and `node_modules/` ignored.

## 5. Check locally and deploy

With Node 24 installed, run:

```bash
npm ci
npm run build
npm run preview
```

Open the preview server's printed local address at `/multiplicative-weights/`. For the usual port, that is `http://localhost:4321/multiplicative-weights/`. Check each section, then stop the preview with Ctrl+C.

Commit the hosting configuration and push:

```bash
git add astro.config.mjs .github/workflows/deploy.yml
git commit -m "Configure GitHub Pages deployment"
git push
```

On GitHub, open **Actions → Deploy to GitHub Pages**. Once the build and deploy jobs succeed, open the deployment link or **Settings → Pages → Visit site**. GitHub notes that publication can take up to 10 minutes after a push. [Viewing the published site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site#viewing-your-published-site).

## 6. Publish later changes

From this repository directory, make and check your changes, then:

```bash
npm run build
git add .
git commit -m "Update website"
git push
```

Every push to `main` runs the workflow again. You can also start it manually using **Actions → Deploy to GitHub Pages → Run workflow**.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No workflow appears | `.github/workflows/deploy.yml` must be committed at the repository root on `main`. |
| Deployment fails with a Pages or permission error | Confirm **Settings → Pages → Source: GitHub Actions** and retain the workflow's permissions and `github-pages` environment. Check any repository or organization restrictions reported in the job log. |
| The site is unstyled or links return 404 | Confirm the repository name matches `base` exactly, rebuild, and open the URL including `/multiplicative-weights/`. |
| Build fails on GitHub | Open the failed step's log. Reproduce with Node 24, `npm ci`, and `npm run build`; ensure the lockfile is committed. |
| A new Markdown link skips the repository path | Use `sitePath()` in components, or a correctly relative URL in authored Markdown. |
| Old content is still showing | Confirm the latest deployment succeeded before refreshing the browser. |

The workflow follows GitHub's artifact-based publishing model. You do not need a `gh-pages` branch, a personal access token for deployment, or an Astro server adapter. [GitHub workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## If you want a different URL later

For a repository named exactly `YOUR_USERNAME.github.io`, use `site: 'https://YOUR_USERNAME.github.io'` and remove `base`; the site then lives at the account root. [GitHub site types](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#types-of-github-pages-sites).

For a custom domain, follow the official [GitHub custom-domain guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) before changing the Astro URL configuration.
