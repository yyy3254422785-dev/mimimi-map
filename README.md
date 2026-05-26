# ShibaSteps

**Team name:** mimimi  
**Project type:** Orbital MVP / Goal-tracking web application  
**Tech stack:** React + Vite

---
## 1. Project Overview

**ShibaSteps** is a Shiba-themed goal-tracking web application designed to help users turn long-term goals into manageable daily actions.

Many people set goals such as improving fitness, studying consistently, building a habit, or finishing a project. However, these goals often fail because they are too vague, too large, or not connected to everyday action. ShibaSteps focuses on this gap: helping users break down goals into daily plans, complete small tasks consistently, and stay motivated through a cute, low-pressure interface.

The MVP currently focuses on the core user experience of:

- Creating or viewing goals
- Breaking goals into daily tasks
- Checking off daily progress
- Maintaining streaks
- Earning cute rewards such as bone points
- Simulating a small community feature called **Dog Circle**

The product uses a playful Shiba visual style to make goal-tracking feel less stressful and more encouraging.

---
## 2. Problem Statement

A common reason people fail to maintain goals is not lack of ambition, but lack of daily structure.

For example, a user may say:

> “I want to become fitter.”  
> “I want to study more consistently.”  
> “I want to finish my project earlier.”

These goals are meaningful, but they are too broad. Without daily reminders, smaller action steps, and visible progress, users may easily delay or give up.

ShibaSteps aims to solve this specific problem:

> How might we help users translate long-term goals into daily actions and maintain motivation through simple tracking, rewards, and social encouragement?

---

## 3. Target Users

ShibaSteps is mainly designed for students and young adults who want to build better habits or manage personal goals.

Potential users include:

- University students managing academic tasks, projects, and self-study plans
- Students preparing for exams who need consistent revision routines
- People trying to build health, fitness, or lifestyle habits
- Users who like cute, friendly, low-pressure productivity tools
- Users who benefit from community encouragement and visible progress tracking

---

## 4. Core Idea

The core idea of ShibaSteps is simple:

1. Users set a long-term goal.
2. The goal is broken down into smaller daily tasks.
3. Users check off completed tasks each day.
4. Completed tasks contribute to streaks and bone points.
5. Users can share progress in a Dog Circle community.
6. Community interaction provides encouragement and accountability.

Instead of making productivity feel strict or stressful, ShibaSteps uses a cute Shiba-themed design to make progress feel friendly and rewarding.

---

## 5. Main Features

### 5.1 Long-Term Goal Tracking

Users can create or view long-term goals. These goals represent larger objectives that cannot be completed in one day.

Examples:

- Finish an Orbital milestone
- Study CS2040C regularly
- Exercise three times a week
- Improve English writing
- Build a healthier sleep schedule

The purpose of long-term goals is to give users direction.

---

### 5.2 Daily Plan

Each long-term goal can be broken down into smaller daily tasks.

Instead of only seeing a large goal, users can focus on what they need to do today.

Example:

Long-term goal:

> Improve fitness

Daily tasks:

- Stretch for 10 minutes
- Drink enough water
- Complete one short workout
- Record today’s progress

This feature helps users move from intention to action.

---

### 5.3 Any-Date Planning

Users may want to add tasks not only for today, but also for future dates.

For example:

- Add a reminder for next Monday
- Plan a study task for the weekend
- Add a project meeting note for a specific date
- Prepare a checklist before a deadline

This allows the app to support flexible planning rather than only same-day task tracking.

---

### 5.4 Task Completion Checklist

Users can check off completed daily tasks.

This gives immediate feedback and helps users clearly see what has been done.

The checklist design is intentionally simple because the MVP prioritizes clarity over complex project management features.

---

### 5.5 Delay / Reschedule Option

If a task is not completed, the user can choose whether to delay it.

This is important because real life is not perfectly predictable. A useful goal-tracking app should not punish the user harshly for missing one task.

Instead, the app should help the user recover and continue.

Potential logic:

- If the user completes the task, it is marked as done.
- If the user does not complete it, they may move it to another date.
- The app encourages continuation instead of guilt.

---

### 5.6 Streak Calendar

The streak calendar shows whether the user has checked in consistently.

In the ShibaSteps concept, streaks are represented with cute paw-print check-ins.

The purpose of the streak system is to make progress visible.

It helps users answer:

- Did I make progress today?
- How consistent have I been this week?
- Am I maintaining my habit?

---

### 5.7 Bone Points

When users complete tasks, they can earn **bone points**.

Bone points act as a simple reward system.

They are not meant to be a complicated game economy. Instead, they provide a small motivational reward for consistent action.

Possible uses of bone points in future versions:

- Unlocking Shiba decorations
- Customising a Dog Circle
- Unlocking badges
- Showing progress levels

---

### 5.8 Dog Circle Community

Dog Circle is a small community feature where users can share daily check-ins and encourage each other.

The intended design is that around 20 users may form a small circle.

Possible community actions include:

- Posting daily progress
- Giving encouragement
- Liking or reacting to check-ins
- Commenting on friends’ updates
- Contributing points to decorate the Dog Circle

This feature addresses the social side of habit-building. Many users are more likely to stay consistent when they feel seen and supported.

For the current MVP, Dog Circle may be simulated with mock data or static UI to demonstrate the intended interaction flow.

---

## 6. Proof of Concept

### 6.1 Purpose of the Proof of Concept

The proof of concept aims to show that the core ShibaSteps experience can be represented as a working web interface.

At this stage, the priority is not to build every final feature, but to demonstrate the main user flow:

1. User enters the app
2. User views goals and daily tasks
3. User interacts with checklist-style task completion
4. User sees progress indicators such as streaks or points
5. User understands the community concept through Dog Circle

This confirms that the idea can be translated into a usable digital product.

---

### 6.2 Current MVP Scope

The current MVP focuses on frontend implementation using React and Vite.

The current version may include:

- A landing or home page
- Goal cards
- Daily task checklist
- Streak calendar mockup
- Bone points display
- Dog Circle community mockup
- Shiba-themed visual design
- Basic state changes for interactive elements

Depending on implementation progress, some features may currently use mock data instead of a fully connected database.

This is acceptable for the proof-of-concept stage because the main goal is to validate the user interface and interaction flow.

---

### 6.3 What the MVP Demonstrates

The MVP demonstrates:

- The main concept of goal breakdown
- The daily check-in workflow
- A friendly and motivating visual style
- A simple reward system
- A possible social accountability feature
- A feasible direction for further development

The MVP does not claim to be a fully deployed production-level application yet.

---

## 7. Tech Stack

### Frontend

- **React**
  - Used to build reusable UI components
  - Suitable for creating interactive single-page applications

- **Vite**
  - Used as the build tool and development server
  - Provides fast project setup and fast local preview

- **CSS**
  - Used for styling the interface
  - Supports the Shiba-themed visual design

### Development Tools

- **GitHub**
  - Used for version control and collaboration

- **GitHub Codespaces**
  - Used as a cloud-based development environment
  - Allows team members to edit and preview the project without heavy local setup

---

## 8. Project Structure

A typical structure of this React + Vite project is:

```text
shibasteps/
├── public/
│   └── assets or static files
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   └── components/
│       └── reusable UI components
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

### Important Files

#### `src/main.jsx`

This is the React entry point. It connects the React application to the HTML root element.

#### `src/App.jsx`

This is the main application component. Most of the visible page content starts from here.

#### `src/index.css`

This file contains global styling for the app.

#### `package.json`

This file stores project information, dependencies, and scripts such as:

```bash
npm install
npm run dev
```

---

## 9. How to Run the Project

### 9.1 Run in GitHub Codespaces

1. Open the GitHub repository.
2. Click **Code**.
3. Open the project using **Codespaces**.
4. Wait for the Codespace environment to load.
5. Open the terminal.
6. Install dependencies:

```bash
npm install
```

7. Start the development server:

```bash
npm run dev
```

8. Open the forwarded port, usually:

```text
http://localhost:5173
```

In Codespaces, this can usually be opened from the **Ports** tab by selecting the port and clicking **Open in Browser**.

---

### 9.2 Run Locally

If running locally, make sure Node.js and npm are installed.

Then run:

```bash
npm install
npm run dev
```

After that, open the local development URL shown in the terminal.

For Vite projects, it is commonly:

```text
http://localhost:5173
```

---

## 10. Development Workflow

A recommended workflow for team collaboration is:

1. Pull the latest code from GitHub.
2. Make changes in a separate branch if needed.
3. Test the project locally or in Codespaces.
4. Stage the changed files.
5. Commit with a clear message.
6. Push the changes to GitHub.
7. Create a pull request if working through branches.
8. Review and merge changes carefully.

Example commands:

```bash
git status
git add .
git commit -m "Add daily check-in UI"
git push
```

---

## 11. GitHub Collaboration Notes

### Commit

A commit records a snapshot of changes.

Good commit messages should be specific.

Examples:

```bash
Add goal card component
Update ShibaSteps homepage layout
Fix daily checklist styling
Add Dog Circle mockup
```

Avoid unclear messages such as:

```bash
update
change
final final
```

---

### Branch

A branch is a separate working version of the project.

Branches are useful when different teammates are working on different features.

Example:

```bash
git checkout -b feature/dog-circle
```

---

### Pull Request

A pull request is a request to merge changes from one branch into another branch, usually into `main`.

It allows teammates to review changes before merging.

---

## 12. Current Progress

Current progress may include:

- Basic React + Vite project setup
- Main ShibaSteps interface
- Shiba-themed goal-tracking layout
- Daily check-in section
- Streak calendar concept
- Bone points reward display
- Dog Circle community mockup
- GitHub repository setup
- Codespaces-based development workflow

This section should be updated regularly as the project develops.

---

## 13. Future Improvements

Future versions of ShibaSteps may include:

### 13.1 User Authentication

Allow users to sign up and log in.

This would make it possible to store user-specific goals and progress.

---

### 13.2 Database Integration

A database can be used to store:

- User accounts
- Long-term goals
- Daily tasks
- Completed check-ins
- Bone points
- Dog Circle posts
- Comments and reactions

Possible database options include:

- Firebase
- Supabase
- MongoDB
- PostgreSQL

The final choice depends on project requirements, team familiarity, and deployment needs.

---

### 13.3 Real Goal Creation

Instead of using mock data, users should be able to create, edit, and delete their own goals.

Possible actions:

- Add a new long-term goal
- Break it into daily tasks
- Edit task details
- Delete unnecessary tasks
- Mark tasks as completed

---

### 13.4 Real Calendar Integration

A more complete version could include:

- Date-based task planning
- Calendar view
- Rescheduling incomplete tasks
- Weekly review
- Monthly progress summary

---

### 13.5 Dog Circle Backend

The Dog Circle feature could become more realistic by supporting:

- User posts
- Likes
- Comments
- Shared group points
- Group decoration rewards
- Privacy controls

---

### 13.6 Data Visualization

The app could show progress through:

- Weekly completion rate
- Long-term goal progress
- Streak statistics
- Task completion history
- Community activity summary

---

### 13.7 Improved Reward System

Bone points could be used for:

- Unlocking badges
- Decorating a Shiba avatar
- Customising the Dog Circle
- Unlocking achievement levels

The reward system should remain simple and supportive. It should not distract from the main goal of building consistent habits.

---
