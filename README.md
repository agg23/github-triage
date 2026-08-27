# GitHub Triaging Tool

> [!WARNING]
> Unlike almost all of my other content, this repository is almost entirely produced via LLMs. I have attempted to corral it into writing in my style, and have "reviewed" the changes, but I don't think that has helped much.

A tool for triaging GitHub issues and PRs quickly and efficiently across arbitrary repos and orgs. Gathers and stores the data periodically to a server in order to enable instant loads (rather than waiting for GitHub APIs). Provides a web interface for filtering and sorting issues/PRs based on their current state and activity.

Additionally allows for "snoozing" items, which allows you to remove an item from the view, but have it reappear on new activity.

## Usage

```
npm install
npm run dev:server
npm run dev
```

Visit the app at http://localhost:5173

On first run, visit Settings and enter a GitHub PAT containing the `repo` or `public_repo`, and `read:org` permissions to the repos you care about. Go to Sources and add the repos/orgs you wish to track.
