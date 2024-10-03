---
dg-publish: false
title: Information Management in Organizations
# description
authors: qmchugh
# image
# slug
tags: []
# keywords: []
hide_table_of_contents: false
draft: true
publish: true
publish-path: blog/2023
publish-filename:
created: 2023-07-01T11:53:11-04:00
modified: 2023-07-06T16:26:11-04:00
---

## Foreword

I believe poor information management practices is one of biggest issues plaguing organizations today. It's a [tragedy of the commons](https://en.wikipedia.org/wiki/Tragedy_of_the_commons), yes, but a very tractable one, I think.

1. \*_This document is very opinionated_- and consists of things I have learned through my own forays into knowledge management and PM work. I welcome disagreement - if this post sparks any thoughts, please feel free to share in the comments on the bottom of this page.

## Purpose

The following document outlines my general recommendations for improving documentation, organization, and team coordination in any organization.

## Google Drive

### General Organization

- In my experience, using a modified version of the [Johnny Decimal system](https://johnnydecimal.com/) with folders helps keep disorganization at bay
  - For example, if you want to have a folder containing key documents that new volunteers should read, you can put “000” in front of the folder name (e.g. “000 Start Here”) to make the folder the first thing in the Google Drive
- Based on what's already in the [Google Drive](https://drive.google.com/drive/u/0/folders/1r_74bvlPCgn_eHrUQ1mDwO2rsXDgSDle), here's a folder structure to consider:
  - **Wiki**- Internal documents that are generally useful to newcomers and seasoned team members alike.
  - **Meeting Notes**- _All_ meeting notes go here, regardless of team. These can be separated out into individual folders if there's a good reason for it.
- For organizing technical documentation, the \*_[Diataxis framework](https://diataxis.fr/)_- is a great starting point

### Documents

- When in doubt, use a section instead of a bullet - that way, it's easier to for future users to browse the document via its table of contents

#### Date-Specific (e.g. meeting notes, design reviews, research plans, etc)

- Should have the following naming convention “**YYYY-MM-DD &lt;Document Name>”**
  - Where…
    - `YYYY` - The year the document was created
    - `MM` - The month the document was created (with a leading “0”)
    - `DD` - The date the document was created (with a leading “0”)
  - e.g. “2023-03-07 My Meeting.gdoc”
  - Why?
    - Puts files in chronological order by default, making folders easier to peruse through
    - Puts the most recent files at the top of each containing folder, making it easier to see where you last left off
    - You can easily find files by the date created (useful when searching for meeting notes, design reviews, etc)
- Meeting Notes
  - Should be generated from a Google Calendar event:
    - How to: [https://support.google.com/docs/answer/11324079?hl=en](https://support.google.com/docs/answer/11324079?hl=en)
  - Should have:
    - An agenda (i.e. what will be discussed during the meeting)
      - Including an decisions to be made and the context surrounding those decisions
    - A list of attendees (i.e. who actually attended the meeting)
    - Notes (i.e. notes taking during the meeting)
    - Action Items (i.e. tasks or actions that were identified during the meeting)
  - Recurring meetings should use a **single document**for their meeting notes - this makes it such that meeting attendees can reference previous meeting notes simply by scrolling down
    - The contents of the document should be in chronological order (i.e. most recent meeting notes at the top of the document)
      - For each meeting, generate a new template by typing “@meeting notes” in Google Docs ([Instructions](https://support.google.com/calendar/answer/6192039#zippy=%2Cadd-meeting-notes-to-a-new-event-from-google-calendar%2Cadd-meeting-notes-to-events-from-google-docs))

#### Standalone Documents

- Should have **Purpose** section with a brief blurb describing **why** this document exists (e.g. what are the goals of the document? What might someone in the future gain from reading it?)
- Should have a Table of Contents inserted directly underneath the purpose section ([Instructions](https://support.google.com/docs/answer/116338?hl=en&co=GENIE.Platform%3DDesktop#zippy=%2Cadd-or-delete-a-table-of-contents:~:text=On%20your%20computer,contents%20to%20look.))
