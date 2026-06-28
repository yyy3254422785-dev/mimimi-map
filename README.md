# ShibaSteps

A smart productivity companion that combines a React web application with an ESP32-powered physical device to make task management more engaging and rewarding.

---

# Overview

ShibaSteps is a gamified task management system designed to improve users' productivity through both digital and physical interactions.

Unlike traditional to-do list applications, ShibaSteps integrates a React-based web application with an ESP32 hardware device. Tasks created on the web are synchronized in real time to the ESP32, allowing users to manage their daily work using physical controls while receiving visual and tactile feedback through an OLED display, a stepper motor, and a buzzer.

The project aims to bridge software and hardware, creating a more interactive and enjoyable productivity experience.

---

# Features

## Daily Task Management

- Create and delete daily tasks
- Mark tasks as completed
- Automatically organize tasks by date
- Persistent local storage

## Long-term Goal Tracking (Milestone 2)

- Create multiple long-term goals
- Associate daily tasks with individual goals
- Track progress using progress bars
- Dedicated page for managing all long-term goals

## Daily Check-in

- One check-in per day
- Calendar view with completed-day paw print indicators
- Local-time based date handling

## Pomodoro Timer

- Adjustable focus duration
- Start, pause, resume and reset timer
- Shared timer state between the frontend and ESP32

## Shiba-themed Interface

- Shiba Inu inspired design
- Modern card-based layout
- Responsive desktop interface

---

# Hardware Integration

ShibaSteps extends beyond a web application by integrating an ESP32 development board.

The hardware system includes:

- OLED display for current tasks and timer
- Infrared remote control for physical interaction
- Stepper motor providing a completion reward animation
- Passive buzzer for operation feedback
- Wi-Fi connection for real-time synchronization

Users can interact with their daily tasks without relying solely on the web interface.

---

# Real-time Synchronization

The React frontend and ESP32 communicate through an Express backend server.

The synchronization system supports:

- Task synchronization
- Task completion updates
- Shared timer state
- OLED display updates
- Physical interactions triggering software updates

---

# System Architecture

```text
                 React Frontend
                       │
                REST API (HTTP)
                       │
                Express Backend
                       │
                Shared JSON State
                  │            │
             React UI       ESP32
                               │
      ┌──────────┬──────────┬──────────┬──────────┐
      │          │          │          │
    OLED      IR Remote   Stepper    Buzzer
                           Motor
```

---

# Technology Stack

## Frontend

- React
- Vite
- JavaScript
- CSS

## Backend

- Node.js
- Express

## Hardware

- ESP32
- Arduino IDE

## Communication

- REST API
- JSON

## Electronic Components

- OLED Display
- Infrared Receiver
- Stepper Motor
- Passive Buzzer

---

# Getting Started

## Frontend

```bash
npm install
npm run dev
```

## Backend

```bash
cd server
npm install
node index.js
```

## ESP32

1. Open the Arduino project.
2. Configure the Wi-Fi credentials.
3. Upload the sketch to the ESP32.
4. Power the board and ensure it connects to the backend server.

---

# Future Improvements

- True streak tracking with missed-day detection
- Automatic rollover of unfinished tasks
- Weekly and monthly productivity analytics
- More interactive hardware animations
- Mobile application support

---

# Team

## Xu Peiyao

- Frontend Development
- ESP32 Hardware Integration
- UI Design

## Yu Jinlin

- Frontend Development
- Backend Development
- System Integration

---

# Project Vision

We believe productivity should not feel repetitive or mechanical.

By combining software with physical interactions, ShibaSteps transforms everyday task management into a more engaging, rewarding and enjoyable experience.