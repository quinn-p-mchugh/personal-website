---
title: "YearSpread: A handy calendar spreadsheet to visualize and sync annual events, trips, and more to a specified Google Calendar."
sidebar_label: "YearSpread" 
slug: year-spread 
description: "A handy calendar spreadsheet to visualize and sync annual events, trips, and more to a specified Google Calendar."
keywords: ["google sheets to google calendar", "sync spreadsheet to calendar", "year view google calendar", "yearly planning spreadsheet", "annual planning spreadsheet", "google sheets calendar sync", "spreadsheet integration with calendar", "google calendar synchronization", "yearly view in google calendar", "planning in spreadsheets"]
tags: ["Productivity", "Life", "Google Calendar", "Google Sheets"]
#image: ""
sidebar_position: 2
draft: false
publish: true
publish-path: docs-projects
publish-filename: 
created: 2023-07-01T11:53:11-04:00
modified: 2023-07-06T21:54:53-04:00
---

**YearSpread** is a handy yearly calendar template to help you plan out your year(s) in a digital format. I've found this calendar to be extremely useful for blocking out time for all-day events, weekend trips, vacations, etc. and keeping track of annual events like festivals or conferences. I hope you also find it useful!

## [Get the spreadsheet](https://docs.google.com/spreadsheets/d/1UezLLrUs2CTYpgBbuxlh0Mds6k-ykcy1hNU9sLdnbeQ/edit?usp=sharing)

## Setting up syncing
YearSpread features one-way syncing (spreadsheet → calendar) with a Google Calendar of your choice. To enable this, follow the steps below:

### Part 1 of 2: Specify your calendar ID
1. If you have not already done so, [make a copy of the spreadsheet](https://support.google.com/docs/answer/49114?hl=en&co=GENIE.Platform%3DDesktop#zippy=%2Cmake-a-copy-of-a-file).
2. Navigate to the `⚙️CONFIG` sheet.
3. In cell B3 (white box), enter the ID of the calendar you wish to sync spreadsheet entries with. [Find your calendar ID using these instructions](https://it.umn.edu/services-technologies/how-tos/google-calendar-find-your-google#:~:text=Finding%20Your%20Google%20Calendar%20ID&text=Click%20on%20the%20three%20vertical,will%20find%20your%20Calendar%20ID.).

:::danger
**All events in the calendar you specify will be DELETED prior to syncing.** It is strongly recommended you create a new calendar to use exclusively with this spreadsheet.
:::

### Part 2 of 2: Setup periodic syncing
_Now that the calendar ID is added, we will setup a [time-driven trigger](https://developers.google.com/apps-script/guides/triggers/installable#time-driven_triggers) to sync spreadsheet entries with our Google Calendar each hour.

1. On the top menu bar, click **Extensions > Apps Script**. You should be directed to the Google Apps Script interface.
2. Hover over the left sidebar and click **Triggers** (clock icon).
3. On the bottom right, press the **Add Trigger** button.
4. Specify the following settings:
  - Set **Choose which function to run** to **syncEventsWithGoogleCalendar**.
  - Set **Select event source** to **Time-driven**.
  - Set **Select type of time based trigger** to **Hour timer**.
  - Set **Select hour interval** to **Every hour** (or whichever selection you prefer).
6. Click **Save**. An authorization window should appear.
7. In the authorization window, select your Google account.

:::info
After selecting your Google Account, you should receive a warning that "Google hasn't verified this app". This is a standard warning indicating that the script you're authorizing requires sensitive info from your Google Account (in this case, authorization to write to your calendar). Each time the trigger fires, it will run this script.

If you are hesitant to proceed, you are welcome to press **Back to Safety**, go to the **Editor** tab and inspect the script yourself. This code is local to your account and cannot be edited by external parties, so feel free to modify as you please.
:::

8. In the authorization window, click **Advanced**.
9. Click **Go to sync-spreadsheet-events-with-google-calendar (unsafe)**.
10. Review the information. If you are ready to proceed, click **Allow**.

🎉 **Woo hoo! Any events you add to your year calendar will now be automatically synced to the calendar specified.**
