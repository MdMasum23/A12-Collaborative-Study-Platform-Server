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

        // []
        app.patch('/users/role/:id', verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const { role } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = { $set: { role } };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // []
        app.delete('/users/:id', verifyFBToken, async (req, res) => {
            const { id } = req.params;

            const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });

            res.send(result);
        });



        // CollabStudy: SESSIONS API:=============================================
        // [get all the session (F:allStudySessions)]
        app.get('/sessions', verifyFBToken, async (req, res) => {
            try {
                const result = await sessionsCollection.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch sessions' });
            }
        });

        // [all available study sessions (F:studySessions)]:
        app.get('/sessions/available', async (req, res) => {
            try {
                const sessions = await sessionsCollection.find({ status: 'approved' })
                    // .sort({ registrationStart: 1 })
                    .toArray();

                res.send(sessions);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch sessions', error });
            }
        });

        // [only 6 approved session (F:AvailableSessions)]:
        app.get('/sessions/approved', async (req, res) => {
            try {
                const sessions = await sessionsCollection.find({ status: 'approved' })
                    // .sort({ registrationStart: 1 })
                    .limit(6)
                    .toArray();

                res.send(sessions);
            } catch (error) {
                console.error("Error fetching approved sessions:", error);
                res.status(500).send({ message: 'Error fetching approved sessions', error: error.message });
            }
        });

        // [GET All Tutor list (F:Tutor)]
        app.get('/tutors', async (req, res) => {
            const sessions = await sessionsCollection.find({ status: 'approved' }).toArray();

            const tutors = [];

            sessions.forEach(session => {
                const existingTutor = tutors.find(t => t.tutorEmail === session.tutorEmail);
                if (existingTutor) {
                    existingTutor.sessionCount += 1;
                } else {
                    tutors.push({
                        tutorName: session.tutorName,
                        tutorEmail: session.tutorEmail,
                        sessionCount: 1
                    });
                }
            });

            res.send(tutors);
        });

        // [details about the session (F:SessionDetails)]:
        app.get('/sessions/:id', verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const session = await sessionsCollection.findOne({ _id: new ObjectId(id), status: 'approved' });
            res.send(session);
        });

       