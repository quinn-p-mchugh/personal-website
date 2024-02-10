---
title: "Things you should know about Jira before you begin"
#slug:
#description:
#keywords: []
tags: []
authors: qmchugh
#image:
hide_table_of_contents: false
draft: true
---

## Jira Structure

Jira shines in how flexible and (generally) configurable it is. However, things like statuses (but not transitions between statuses) being shared across workflows can introduce challenges. Plan accordingly.

## There will be things that make you go "how is this a bug"

Jira has a help article that explains how to configure sub-task fields displayed on parent issues by modifying the `jira.table.cols.subtasks` property.

However, when this field is modified, [it doesn't cause anything to occur]. This has been a known bug for a substantial amount of time.

https://jira.atlassian.com/browse/JRACLOUD-70206
