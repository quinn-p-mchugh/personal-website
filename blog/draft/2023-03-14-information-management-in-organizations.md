
---

title: (Title)

# description

authors: qmchugh

# image

# slug

tags: []

# keywords: []

hide_table_of_contents: false
draft: true
---

# PhillyTRUCE Project Management Feedback

Prepared by  on

## Purpose

The purpose of this document is to provide feedback to the PhillyTRUCE team regarding organization of the [PhillyTRUCE Google Drive](https://drive.google.com/drive/u/0/folders/1r_74bvlPCgn_eHrUQ1mDwO2rsXDgSDle) and make recommendations for improving documentation, organization, and team coordination.

**Note:  \
**

1. **This document is very opinionated** and consists of things I have learned through my own forays into knowledge management and PM work. I welcome disagreement - if you have any questions, comments or concerns, please [add a comment](https://support.google.com/docs/answer/65129?hl=en&co=GENIE.Platform%3DDesktop#zippy=%2Cadd-a-comment:~:text=On%20your%20computer,Click%20Comment.) directly to this document.
2. I do not yet have access to any Trello boards used by teams, so any commentary on existing work management tools is out of scope for this document.

**Table of Contents**

[TOC]

## Google Drive {#google-drive}

### General Organization {#general-organization}

* In my experience, using a modified version of the [Johnny Decimal system](https://johnnydecimal.com/) with folders helps keep disorganization at bay
  * For example, if you want to have a folder containing key documents that new volunteers should read, you can put “000” in front of the folder name (e.g. “000 Start Here”) to make the folder the first thing in the Google Drive
* Based on what’s already in the [Google Drive](https://drive.google.com/drive/u/0/folders/1r_74bvlPCgn_eHrUQ1mDwO2rsXDgSDle), here’s a folder structure to consider:
  * **Wiki**- Internal documents that are generally useful to newcomers and seasoned team members alike
    * e.g.
            *
  * **Reference**- Any literature or external resources that may be of use to PhillyTRUCE team members
    * e.g.
            *  
            *
            *
  * **Meeting Notes**- _All_ meeting notes go here, regardless of team. These can be separated out into individual folders, if there’s a good reason for it.
    * E.g.
            *
            *
  * **Training**- Training documents for PhillyTRUCE representatives
    * e.g.
            *
  * **Design**- _Working_documents related to design/UX work (no meeting notes)
    * e.g.
            *
            *
            *
  * **Engineering**- _Working_documents related to engineering work (no meeting notes) \

* For organizing technical documentation, the **[Diataxis framework](https://diataxis.fr/)** is a great starting point

### Documents {#documents}

* If you use colors to divide up [a document](https://docs.google.com/document/d/1hMMLhbpPVVicuufgiRe_vCAiIAnfbOjxfCS1lbt4wdM/edit?usp=sharing), take care to include a key to indicate which color means what
  * When selecting, be weary of using combinations that are not [color-blind friendly](https://www.getfeedback.com/resources/ux/how-to-design-for-color-blindness/)
* When in doubt, use a section instead of a bullet - that way, it’s easier to for future users to browse the document via its table of contents

#### Date-Specific (e.g. meeting notes, design reviews, research plans, etc) {#date-specific-e-g-meeting-notes-design-reviews-research-plans-etc}

* Should have the following naming convention “**YYYY-MM-DD &lt;Document Name>”**
  * Where…
    * YYYY - The year the document was created
    * MM - The month the document was created (with a leading “0”)
    * DD - The date the document was created (with a leading “0”)
  * e.g. “2023-03-07 PhillyTRUCE Project Management Audit.gdoc”
  * Why?
    * Puts files in chronological order by default, making folders easier to peruse through
    * Puts the most recent files at the top of each containing folder, making it easier to see where you last left off
    * You can easily find files by the date created (useful when searching for meeting notes, design reviews, etc)
* Meeting Notes
  * Should be generated from a Google Calendar event:
    * How to: [https://support.google.com/docs/answer/11324079?hl=en](https://support.google.com/docs/answer/11324079?hl=en)
  * Should have:
    * An agenda (i.e. what will be discussed during the meeting)
      * Including an decisions to be made and the context surrounding those decisions
    * A list of attendees (i.e. who actually attended the meeting)
    * Notes (i.e. notes taking during the meeting)
    * Action Items (i.e. tasks or actions that were identified during the meeting)
  * Recurring meetings should use a **single document**for their meeting notes - this makes it such that meeting attendees can reference previous meeting notes simply by scrolling down
    * The contents of the document should be in chronological order (i.e. most recent meeting notes at the top of the document)
      * For each meeting, generate a new template by typing “@meeting notes” in Google Docs ([Instructions](https://support.google.com/calendar/answer/6192039#zippy=%2Cadd-meeting-notes-to-a-new-event-from-google-calendar%2Cadd-meeting-notes-to-events-from-google-docs))

#### Standalone Documents (e.g. [Helpful Resources](https://docs.google.com/document/d/1BgfXpDc_WjpeKMw1Tx67CRPjfvjHPpaRgtOtTQQ__8A/edit?usp=sharing)) {#standalone-documents-e-g-helpful-resources}

    * Should have **Purpose **section with a brief blurb describing **why** this document exists (e.g. what are the goals of the document? What might someone in the future gain from reading it?)
    * Should have a Table of Contents inserted directly underneath the purpose section ([Instructions](https://support.google.com/docs/answer/116338?hl=en&co=GENIE.Platform%3DDesktop#zippy=%2Cadd-or-delete-a-table-of-contents:~:text=On%20your%20computer,contents%20to%20look.))

## Work Management {#work-management}

There are [numerous tools](https://www.zotero.org/groups/4878976/quinn_mchugh_public/collections/MHCGHRMV) available that can help coordinate teams and tasks. I have have provided some you might consider below.

### Recommendation {#recommendation}

For this particular project (assuming a $0 budget), I would recommend either **ClickUp**, **GitHub Projects**, or **Notion**, depending on the team’s requirements. Specifically:

* If the a **10 guest user limitation** is **not**a deal breaker, I would recommend **Notion**
* If **tight GitHub integration** is paramount, I would recommend **GitHub Projects**
* For the**best “all around” PM tool** with a generous free plan, I would recommend **ClickUp**

**Note:**Any tools that permitted 14 users or less users on the free plan were not considered.

### [ClickUp](https://clickup.com/pricing) {#clickup}

* Pros
  * Generous free version
    * 100MB Storage - **Can use Google Drive instead**
    * **Unlimited Tasks**
    * **Unlimited Free Plan Members** (with create and edit permissions)
    * iOS + Android app
    * Two-Factor Authentication
    * Collaborative Docs - Using Google Docs recommended to prevent vendor lock-in
    * **Whiteboards**
    * Everything View
    * Real-Time Chat
    * **Kanban Boards**
    * **Sprint Management**
    * Native Time Tracking
    * **Many types of views**
      * List
      * Board
      * Calendar
      * Gantt
      * Timeline
      * Team
      * Table
      * Mind Map
      * Workload
      * Activity
      * Map
    * In-App Video Recording
    * 24/7 Support
* Cons
  * Some describe it as a “jack of all trades, master of none”
  * [GitHub integration](https://clickup.com/integrations/github) is not native
  * Advanced features might buggy ([source](https://www.reddit.com/r/clickup/comments/xohvbb/comment/iq0wvkm/?utm_source=share&utm_medium=web2x&context=3))

### [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) {#github-projects}

* Pros
  * Free public and private projects
  * Directly integrates with GitHub Issues, Pull requests, etc
  * Views
    * Table
    * Board
* Cons
  * Less feature-rich than other tools
  * **No subtasks**(it is possible implement this, but it’s very, very clunky)

### [Notion](https://www.notion.so/pricing) {#notion}

* Pros
  * Can serve as both a wiki and project management tool
  * Task management less robust than other solutions (but still very useful)
  * iOS + Android app
  * **Views**
    * Table view
    * Board view
    * Gallery view
    * List view
    * Timeline (Gantt) view
    * Calendar view
  * Flexible linking
* Cons
  * **Free version limited to 10 guests**

### [Wrike](https://www.wrike.com/price/) {#wrike}

* Pros
  * Unlimited users
  * iOS + Android app
  * Views
    * Board
    * Table
* Cons
  * **Fairly restrictive free version - No gantt chart, dashboards, or calendar view**

### [Asana](https://asana.com/pricing) {#asana}

* Pros
  * Views
    * List
    * Board
    * Calendar
  * 100+ integrations
* Cons
  * **Limited to 15 users on free plan**
  * **No timeline (gantt) view**
