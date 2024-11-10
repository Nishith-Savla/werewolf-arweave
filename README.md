# Online Multiplayer Werewolf Game on Arweave

An online multiplayer game where players take on secret roles as either **villagers** or **werewolves**. Leveraging the unique, decentralized data storage of **Arweave**, this game guarantees a transparent and tamper-proof gaming experience. Each game action, alliance, and betrayal is stored immutably, creating an environment where strategy and secrecy meet transparency and trust.

## Table of Contents

- [Introduction](#introduction)
- [Gameplay](#gameplay)
  - [Roles](#roles)
  - [Objectives](#objectives)
  - [Game Flow](#game-flow)
- [Features](#features)
- [Arweave Integration](#arweave-integration)
- [Installation](#installation)
- [Usage](#usage)
- [License](#license)

## Introduction

In this game, players are assigned roles of either villagers or werewolves at random. Villagers must work together to identify the werewolves hiding among them before it’s too late, while the werewolves must work covertly to eliminate villagers one by one without getting discovered. The game harnesses the power of Arweave's decentralized data storage to store every move, alliance, and betrayal immutably, ensuring a transparent and uncheatable experience.

## Deployment URL

[Werewolf.AO](https://werewolf-arweave_arlink.ar-io.dev/)

## Gameplay

### Roles

- **Villager**: Identify and vote out the werewolves before they overrun the village.
- **Werewolf**: Eliminate villagers without getting exposed.

### Objectives

- **Villagers**: Work together to uncover the werewolves before they eliminate all villagers.
- **Werewolves**: Secretly eliminate the villagers until werewolves outnumber them.

### Game Flow

1. **Role Assignment**: Each player is randomly assigned a role at the start.
2. **Day and Night Cycles**:
   - **Day**: Villagers discuss and vote on whom to eliminate, hoping to catch a werewolf.
   - **Night**: Werewolves secretly choose a villager to eliminate.
3. **Victory Conditions**:
   - Villagers win if they successfully identify and eliminate all werewolves.
   - Werewolves win if they reduce the number of villagers to equal or fewer than their own.

## Features

- **Decentralized, Immutable Game State**: Leveraging Arweave for storing each action and outcome, ensuring transparency and immutability.
- **Online Multiplayer**: Players connect online, each taking on a secret role in real time.
- **Strategic Gameplay**: Includes cooperative and deductive gameplay elements for villagers, and strategic deception for werewolves.

## Arweave Integration

Arweave provides decentralized storage, ensuring that each game state, including player actions and outcomes, is stored permanently. This makes the game tamper-proof and enables players to trust the fairness of the game without reliance on any central authority.

## Installation

To run this game locally, follow these steps:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Nishith-Savla/werewolf-arweave.git
   cd werewolf-arweave
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Run the game**:

   ```bash
   npm run dev
   ```

4. **Access the game**:
   Open your browser and go to `http://localhost:5173` to start playing.

## Usage

1. **Start a Game**: Players join a game lobby and are randomly assigned roles.
2. **Gameplay**: Follow the day-night cycle of discussions, voting, and eliminations as outlined in the [Game Flow](#game-flow) section.
3. **Check Game History**: Using Arweave, every move and decision is stored, allowing players to review game actions after each match.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.
