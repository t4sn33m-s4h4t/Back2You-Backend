const express = require('express')
const app = express()
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const { GoogleGenerativeAI } = require('@google/generative-ai');

const port = process.env.PORT || 5000
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error("API_KEY not found in .env file.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function getTrustScore(claimDesc, founderDesc) {
  const prompt = `You are an intelligent evaluator that compares two item descriptions: one from the claimant and one from the founder.
Instructions:
1. Compare the descriptions carefully, including color, brand, model, condition, features, and any other relevant details.
2. Consider the length and completeness of each description:
   - If a description is short or missing details, give partial marks accordingly.
   - Longer and more detailed descriptions that match should get higher scores.
3. Judge how much the two descriptions likely refer to the same item.
4. Use your reasoning to assign a trust rating from 0 to 100:
   - 0 = completely different items
   - 100 = perfect match
5. Output ONLY a number between 0 and 100. Do NOT include text, explanations, or symbols.
6. Do not round incorrectly — be precise.
Claimant Description: "${claimDesc}"
Founder Description: "${founderDesc}"

Final Answer:`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const score = parseInt(text.match(/\d+/)?.[0] || "0", 10);
    
    return Math.min(Math.max(score, 0), 100);

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return 0;
  }
}


// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded())

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@perahin.x7jfbh3.mongodb.net/?retryWrites=true&w=majority&appName=perahin`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const userCollection = client.db('teamProject').collection('users');
    const postCollection = client.db('teamProject').collection('posts');
    const claimCollection = client.db('teamProject').collection('claims');
    const feedbackCollection = client.db('teamProject').collection('feedbacks');
    const messagesCollection = client.db('teamProject').collection('messages');

    // Users Related API
    app.post('/users', async (req, res) => {
      const user = req.body
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'User already exists' })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.get('/users', async (req, res) => {
      const users = await userCollection.find({}).toArray()
      res.send(users)
    })

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      res.send(user)
    })
    // User related API End.


    // Posts section
    app.post('/posts', async (req, res) => {
      const post = req.body
      const timestamp = new Date()
      post.timestamp = timestamp;
      const result = await postCollection.insertOne(post)
      res.send(result)
    })

    app.get('/posts', async (req, res) => {
      const posts = await postCollection.find({}).toArray()
      res.send(posts)
    })

    app.get('/posts/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const post = await postCollection.findOne(query)
      res.send(post)
    })

    app.get('/posts/latest/topSix', async (req, res) => {
      const posts = await postCollection
        .find()
        .sort({ timestamp: -1 })
        .limit(6)
        .toArray()
      res.send(posts)
    })

    app.get('/posts/myAdded/:email', async (req, res) => {
      const userEmail = req.params.email
      const query = { ownerEmail: userEmail }
      const posts = await postCollection.find(query).toArray()
      res.send(posts)
    })

    app.delete('/posts/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await postCollection.deleteOne(query)
      res.send(result)
    })

    app.put('/posts/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const updatedPost = req.body
      const updateDoc = {
        $set: {
          type: updatedPost.type,
          name: updatedPost.name,
          image: updatedPost.image,
          category: updatedPost.category,
          location: updatedPost.location,
          phone: updatedPost.phone,
          description: updatedPost.description,
          ownerName: updatedPost.ownerName,
          ownerEmail: updatedPost.ownerEmail,
          ownerImage: updatedPost.ownerImage,
          timestamp: new Date(),
        },
      }
      const result = await postCollection.updateOne(query, updateDoc)
      res.send(result)
    })


    // Claims section

    app.post('/claims', async (req, res) => {
      try {
        const claim = req.body;
        claim.status = 'pending';
        const postId = claim.postId;
        const founderItem = await postCollection.findOne({ _id: new ObjectId(postId) });
        if (!founderItem) {
          return res.status(404).json({ error: "Founder item not found" });
        }
        const claimantDesc = claim.details;
        const founderDesc = founderItem.description || "";
        const trustScore = await getTrustScore(claimantDesc, founderDesc);
        claim.trustScore = trustScore;
        const result = await claimCollection.insertOne(claim);
        res.json(result);
      } catch (error) {
        console.error("Error in /claims route:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    // app.post('/claims', async (req, res) => {
    //   const claim = req.body;
    //   claim.status = 'pending';
    //   const result = await claimCollection.insertOne(claim);
    //   res.send(result);
    // });

    app.get('/claims', async (req, res) => {
      const claims = await claimCollection.find().toArray();
      res.send(claims);
    });

    app.get('/claims/user/:email', async (req, res) => {
      const email = req.params.email;
      const query = { claimantEmail: email };
      const claims = await claimCollection.find(query).toArray();
      res.send(claims);
    });

    app.patch('/claims/:id/status', async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      if (!['pending', 'verified', 'rejected'].includes(status)) {
        return res.status(400).send({ message: 'Invalid status' });
      }

      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { status: status } };
      const result = await claimCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    app.get('/claims/:id', async (req, res) => {
      try {
        const id = req.params.id;

        const claim = await claimCollection.aggregate([
          { $match: { _id: new ObjectId(id) } },
          {
            $lookup: {
              from: "posts",
              let: { postId: { $toObjectId: "$postId" } },
              pipeline: [
                {
                  $match: { $expr: { $eq: ["$_id", "$$postId"] } }
                },
                {
                  $project: { name: 1, category: 1, location: 1 }
                }
              ],
              as: "postDetails"
            }
          },
          { $unwind: { path: "$postDetails", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              postId: 1,
              status: 1,
              postAuthor: 1,
              claimantName: 1,
              claimantEmail: 1,
              claimantImage: 1,
              receiptUrl: 1,
              imageUrl: 1,
              details: 1,
              trustScore:1,
              createdAt: 1,
              "postDetails.name": 1,
              "postDetails.category": 1,
              "postDetails.location": 1
            }
          }
        ]).toArray();

        if (!claim.length) {
          return res.status(404).send({ message: "Claim not found" });
        }

        res.send(claim[0]);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    app.delete('/claims/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await claimCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({ success: true, message: 'Claim deleted successfully' });
        } else {
          res.status(404).send({ message: 'Claim not found' });
        }
      } catch (error) {
        console.error('Error deleting claim:', error);
        res.status(500).send({ message: 'Error deleting claim' });
      }
    });


    // Feedback section
    app.post('/feedbacks', async (req, res) => {
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result);
    });

    app.get('/feedbacks', async (req, res) => {
      const feedbacks = await feedbackCollection.find({}).toArray();
      res.send(feedbacks);
    });


    // Chat section
    app.get('/get-chats/:userId', async (req, res) => {
      const currentUserId = req.params.userId;
      try {
        const messages = await messagesCollection.find({
          $or: [
            { sender: currentUserId },
            { receiver: currentUserId }
          ]
        }).toArray();

        if (messages.length === 0) return res.status(200).json([]);

        const chatUsers = {};

        for (const msg of messages) {
          const otherUserId = msg.sender === currentUserId ? msg.receiver : msg.sender;

          if (!chatUsers[otherUserId] || new Date(msg.timestamp) > new Date(chatUsers[otherUserId].timestamp)) {
            chatUsers[otherUserId] = {
              lastMessage: msg.text,
              receiver: msg.receiver,
              timestamp: msg.timestamp,
              lastReadTimestamp: msg.lastReadTimestamp,
            };
          }
        }

        const uniqueUserIds = Object.keys(chatUsers).map(id => new ObjectId(id));

        const users = await userCollection.find({
          _id: { $in: uniqueUserIds }
        }).toArray();

        const response = users.map(user => {
          let chatUser = chatUsers[user._id.toString()]
          let text = chatUser.lastMessage
          let lastReadTimestamp = chatUser.lastReadTimestamp
          return ({
            userName: user.name,
            email: user.email,
            photoURL: user.photoURL,
            lastMessage: text.length > 15 ? text.slice(0, 15) + "..." : text,
            timestamp: chatUser.timestamp,
            isRead: ((currentUserId === chatUser.receiver) && !lastReadTimestamp) ? true : false,
          })
        });
        return res.status(200).json(response);
      } catch (error) {
        console.error('Error fetching users and last messages:', error);
        return res.status(500).json({ message: 'Server error.' });
      }
    });

    app.get('/messages', async (req, res) => {
      try {
        const { sender, receiver } = req.query;

        const messages = await messagesCollection.find({
          $or: [
            { sender, receiver },
            { sender: receiver, receiver: sender }
          ]
        }).sort({ timestamp: 1 }).toArray();

        const lastMessage = messages[messages.length - 1];
        if ((messages.length > 0) && (sender === lastMessage.receiver)) {
          await messagesCollection.updateOne(
            { _id: lastMessage._id },
            { $set: { lastReadTimestamp: new Date() } }
          );
        }

        res.json(messages);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch messages" });
      }
    });

    app.delete('/messages/:id', async (req, res) => {
      try {
        const messageId = req.params.id;
        const result = await messagesCollection.deleteOne({ _id: new ObjectId(messageId) });

        if (result.deletedCount === 1) {
          res.json({ success: true, message: "Message deleted successfully" });
        } else {
          res.status(404).json({ success: false, error: "Message not found" });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: "Failed to delete message" });
      }
    });

    io.on('connect', (socket) => {
      socket.on('authenticate', (userId) => {
        socket.join(userId.toString());
      });

      socket.on('sendMessage', async (data) => {
        console.log("Incoming message data:", data);
        const message = {
          sender: data.sender,
          text: data.text,
          receiver: data.receiver,
          timestamp: new Date(),
        };
        await messagesCollection.insertOne(message);

        io.to(data.receiver).emit('receiveMessage', message)
      });

      socket.on('messageRead', async (messageId) => {
        try {
          await messagesCollection.updateOne(
            { _id: new ObjectId(messageId) },
            { $set: { lastReadTimestamp: new Date() } }
          );
        } catch (error) {
          console.error("Error updating message read status:", error);
        }
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
      });
    });

  } finally {
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello Programmer!')
})

server.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
