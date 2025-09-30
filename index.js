const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');
const admin = require("firebase-admin");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const decodedKey = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');

const serviceAccount = JSON.parse(decodedKey);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@phero1.w4yidho.mongodb.net/?retryWrites=true&w=majority&appName=PHERO1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();


        // Collection Build:
        const usersCollection = client.db('collabStudy').collection('users');
        const sessionsCollection = client.db('collabStudy').collection('sessions');
        const reviewsCollection = client.db('collabStudy').collection('reviews');
        const bookingsCollection = client.db('collabStudy').collection('bookings');
        const notesCollection = client.db('collabStudy').collection('notes');
        const materialsCollection = client.db('collabStudy').collection('materials');


        // Custom Middleware
        const verifyFBToken = async (req, res, next) => {
            // console.log('Header in middleware', req.headers);
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'unauthorized access' })
            };

            const token = authHeader.split(' ')[1]
            if (!token) {
                return res.status(401).send({ message: 'unauthorized access' })
            };

            // Verify The Token:
            try {
                const decoded = await admin.auth().verifyIdToken(token)
                req.decoded = decoded;
                next();
            } catch (error) {
                return res.status(401).send({ message: 'forbidden access' })
            }
        };


        // CollabStudy: USERS API:================================================

        app.get('/users/:email/role', async (req, res) => {
            try {
                const email = req.params.email;

                if (!email) {
                    return res.status(400).send({ message: 'Email is required' });
                }

                const user = await usersCollection.findOne({ email });

                if (!user) {
                    return res.status(404).send({ message: 'User not found' });
                }

                res.send({ role: user.role || 'user' }); // default to 'user' if not set
            } catch (error) {
                console.error('Error getting user role:', error);
                res.status(500).send({ message: 'Internal Server Error' });
            }
        });


        // [users data]
        app.post('/users', async (req, res) => {
            const email = req.body.email;
            const userExists = await usersCollection.findOne({ email });
            if (userExists) {
                return res.status(200).send({ message: 'user already exits', inserted: false });
            }
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // []
        app.get('/users', verifyFBToken, async (req, res) => {
            const search = req.query.search || '';

            const query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };

            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });
