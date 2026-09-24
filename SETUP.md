# Setup: everything happens in a web browser

This takes about an hour of clicking, spread over a day or two because Apple has to approve your developer account. After step 9, nothing will ask you anything until the build is done.

**Costs:**
- Apple Developer Program: $99 a year.
- Free: Vercel (Hobby plan) and GitHub (the free plan covers the planned iPhone builds).
- The build itself runs on your Claude subscription.

## 0. Decide two things first
1. **Who the seller is.**
   - As an individual, your legal name shows on the App Store.
   - As a company, you need a free D-U-N-S number first, which can take days or weeks.
   - Pick one before enrolling.
2. **The support email** to show publicly on cathnivore.com/support.

## 1. Apple Developer Program (start this first; approval can take a day or two)
1. Enrol at developer.apple.com/programs, or in the Apple Developer app on your iPhone.
2. Once approved, find your **Team ID** under Account → Membership details.

## 2. GitHub
1. Create an account at github.com if you don't have one.
2. Create a new repository named `cathnivore`. Choose **Private**, tick "Add a README file", and click Create.
3. On the repository page, click Add file → Upload files. Drag in `SPEC.md`, `STYLE.md`, `CLAUDE.md`, `OWNER.md` and `SETUP.md`, then click Commit.
4. Don't turn on branch protection. The build needs to push to `main`.

## 3. Connect Claude to GitHub
1. Open claude.ai/code. Follow the prompt to connect GitHub and install the Claude GitHub App, giving it access to the `cathnivore` repository.
2. When asked to create a cloud environment (or from the environment picker → Add environment), set:
   - **Name:** `cathnivore`
   - **Network access:** Full. The default "Trusted" setting blocks the browser downloads the tests need and blocks checks on the live site.
   - **Environment variables:** `CLAUDE_CODE_EFFORT_LEVEL=medium`

## 4. Vercel (hosts the website)
1. Sign up at vercel.com with your GitHub account. The free Hobby plan is enough.
2. Click Add New → Project, import the `cathnivore` repository, and click Deploy. The first deploy may fail because there's no app yet; that's expected.
3. Go to Settings → Domains and add `cathnivore.com`. Also add `www.cathnivore.com`, set to redirect to `cathnivore.com`.
4. When Vercel shows what to set at your registrar, choose the **nameservers** option and keep that page open for step 5.
5. Note the project's `.vercel.app` address from the project overview; it goes in `OWNER.md` in step 8.

## 5. GoDaddy (2 minutes)
**First check:** if you use email on cathnivore.com, stop and ask Claude first, because changing nameservers would break it.

1. In GoDaddy, open cathnivore.com → DNS → Nameservers → Change → "I'll use my own nameservers".
2. Enter the two nameservers Vercel showed you and save.

## 6. App Store Connect (after Apple approves you)
1. **Register the bundle ID:** at developer.apple.com, go to Certificates, Identifiers & Profiles → Identifiers → +. Choose App IDs → App, set an explicit Bundle ID of `com.cathnivore.game`, and click Register.
2. **Create the app record:** at appstoreconnect.apple.com, go to Apps → + → New App and fill in:
   - Platform: iOS
   - Name: Cathnivore (if it's taken, choose another and put it in `OWNER.md`)
   - Language: English
   - Bundle ID: `com.cathnivore.game`
   - SKU: `cathnivore-1`
   - Access: Full Access
3. **App Privacy:** in the new app, go to App Privacy → Get Started, answer that you don't collect data, and publish.
4. **Business:** check that no agreement is waiting for you. If you distribute in the EU, you'll be asked about trader status; read Apple's explanation and answer for your situation.
5. **API key:** go to Users and Access → Integrations → App Store Connect API → Team Keys → +. Name it "Cathnivore build", give it **Admin** access, and click Generate. Note the **Issuer ID** and **Key ID**, then download the `.p8` file. Apple lets you download it only once.
6. **TestFlight (optional):** go to TestFlight → Internal Testing and add yourself, so you can play builds on your phone during the week.

## 7. GitHub secrets
1. In the repository, go to Settings → Secrets and variables → Actions → New repository secret, and add these four:
   - `ASC_KEY_ID`: the Key ID
   - `ASC_ISSUER_ID`: the Issuer ID
   - `ASC_KEY_P8`: open the `.p8` file in a text editor and paste everything, including the BEGIN and END lines
   - `APPLE_TEAM_ID`: your Team ID
2. Go to Settings → Actions → General → Workflow permissions, choose "Read and write permissions", and save. This lets the build workflows report their results back.
3. **Optional safety margin:** in your GitHub account settings under Billing, add a payment method and set a spending limit of $20. iPhone build time beyond the free allowance then costs roughly a dollar per build instead of stopping the build.

## 8. Fill in OWNER.md
Open `OWNER.md` on GitHub, click the pencil icon, fill in every value, and commit.

## 9. Create the routine that runs the build
1. Go to claude.ai/code/routines → New routine.
2. **Name:** Cathnivore builder
3. **Prompt** (paste exactly):
   > Continue building Cathnivore. Follow CLAUDE.md and SPEC.md exactly, starting with the session steps in SPEC rule 1.9, including the lock check. Never ask questions or wait for input. Work on the build branch and push your commits there. Move main forward only through npm run release.
4. **Model:** Opus 5.5
5. **Repository:** cathnivore
6. **Environment:** cathnivore
7. **Trigger:** Schedule → Hourly
8. **Connectors:** remove all of them. The build doesn't need any.
9. Click Create, then **Run now**.

## While it runs (optional)
- Each hourly run shows up as a session you can open. A green status only means it ran, not that it succeeded.
- `PROGRESS.md` on the `build` branch shows where the build is.
- cathnivore.com updates at each release.
- TestFlight gets a playable build from about day 6, once the web version is complete. The only earlier iPhone build is a day-1 check that signing works.
- If a run is refused because of your usage limit or the daily routine limit, the next hourly run picks up where it stopped.
- To pause, switch the routine off; to resume, switch it back on.

## When it's done
1. Once the file `DONE` appears, each run ends within seconds. Switch the routine off.
2. Read the final report at the bottom of `PROGRESS.md`.
3. Play the TestFlight build.
4. When Apple approves the app, open it in App Store Connect and click **Release this version**. Release is manual so you get to play it first.
5. If you're not continuing development, revoke the API key.
