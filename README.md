# Back2You - Backend

Back2You's backend is built with **Node.js, Express, MongoDB**, and integrates **Google Gemini AI** to provide a trust score for item claims. It also supports real-time chat functionality and basic CRUD operations for users, posts, claims, and feedback.

## Features
- User authentication and management
- Post creation, editing, and deletion
- Claim submission with AI-generated trust score
- Real-time chat using Socket.IO
- Feedback system
- MongoDB database with collections for users, posts, claims, messages, and feedback

## Tech Stack
- Node.js
- Express.js
- MongoDB (Mongoose)
- Socket.IO
- Google Generative AI (Gemini)
- CORS

## Installation

### 1. Clone the Repository
```bash
git clone https://perahin.onrender.com/
cd back2you-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the root directory and add the following:

```bash
PORT=5000
DB_USER=your_mongodb_user
DB_PASS=your_mongodb_password
API_KEY=your_google_gemini_api_key
```

### 4. Run the Server
```bash
npm run dev
```
The backend will be available at `http://localhost:5000`.

## API Routes

### Users
| Method | Endpoint         | Description               |
|--------|----------------|---------------------------|
| POST   | `/users`        | Add a new user            |
| GET    | `/users`        | Get all users             |
| GET    | `/users/:email` | Get user by email         |

### Posts
| Method | Endpoint                   | Description                     |
|--------|----------------------------|---------------------------------|
| POST   | `/posts`                   | Create a new post               |
| GET    | `/posts`                   | Get all posts                   |
| GET    | `/posts/:id`               | Get post by ID                  |
| GET    | `/posts/latest/topSix`     | Get latest 6 posts              |
| GET    | `/posts/myAdded/:email`    | Get posts by user               |
| DELETE | `/posts/:id`               | Delete a post                   |
| PUT    | `/posts/:id`               | Update a post                   |

### Claims
| Method | Endpoint                 | Description                     |
|--------|-------------------------|---------------------------------|
| POST   | `/claims`               | Submit a claim with trust score |
| GET    | `/claims`               | Get all claims                  |
| GET    | `/claims/user/:email`   | Get claims by user              |
| GET    | `/claims/:id`           | Get claim details               |
| PATCH  | `/claims/:id/status`    | Update claim status             |
| DELETE | `/claims/:id`           | Delete a claim                  |

### Feedback
| Method | Endpoint      | Description        |
|--------|---------------|------------------|
| POST   | `/feedbacks`  | Submit feedback   |
| GET    | `/feedbacks`  | Get all feedbacks |

### Chat
| Method | Endpoint            | Description                          |
|--------|-------------------|--------------------------------------|
| GET    | `/get-chats/:userId` | Get user chats                        |
| GET    | `/messages`         | Get messages between sender & receiver|
| DELETE | `/messages/:id`     | Delete a message                      |

🔒 **Protected routes** require proper authentication.
