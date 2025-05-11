// // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

// // Permission is hereby granted, free of charge, to any person obtaining a copy of
// // this software and associated documentation files (the "Software"), to deal in
// // the Software without restriction, including without limitation the rights to
// // use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
// // the Software, and to permit persons to whom the Software is furnished to do so.

// // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
// // FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// // COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
// // IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// // CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// var createError = require('http-errors');
// var express = require('express');
// var bodyParser = require("body-parser");
// var path = require('path');
// var cookieParser = require('cookie-parser');
// var logger = require('morgan');

// var indexRouter = require('./routes/index');
// var signupRouter = require('./routes/signup');

// var cors = require('cors')

// var app = express();

// // view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

// app.use(logger('dev'));
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public')));

// app.use(cors());

// app.use('/', indexRouter);
// app.use('/signupdb', signupRouter);

// //Here we are configuring express to use body-parser as middle-ware.
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());

// // catch 404 and forward to error handler
// app.use(function(req, res, next) {
//   next(createError(404));
// });

// // error handler
// app.use(function(err, req, res, next) {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};

//   // render the error page
//   res.status(err.status || 500);
//   res.render('error');
// });

// module.exports = app;


// userreg-api-node-beanstalk/api-db/app.js
const express = require('express');
const AWS = require('aws-sdk');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const multerS3 = require('multer-s3');
const cors = require('cors');
const path = require('path'); // For serving static files if needed for S3 uploaded content
// AWS Configuration

const dynamoDBTasksTableName = process.env.DYNAMODB_TASKS_TABLE_NAME; // <<<< NEW


// Initialize Express app
const app = express();

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// AWS Configuration
const region = process.env.AWS_REGION || 'me-south-1';
const dynamoDBTableName = process.env.DYNAMODB_TABLE_NAME;
const s3BucketName = process.env.S3_BUCKET_NAME;
const jwtSecret = process.env.JWT_SECRET;

AWS.config.update({ region: region });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// --- User Authentication Middleware ---
const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded.user; // Add user from payload
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// --- S3 File Upload Middleware Setup ---
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: s3BucketName,
    acl: 'public-read', // Or 'private' if you want to control access via signed URLs
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      // Store in a 'user-uploads/' folder, with a timestamp and original name
      cb(null, `user-uploads/${Date.now().toString()}-${file.originalname}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

function checkFileType(file, cb) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images and Documents Only (jpeg, jpg, png, gif, pdf, doc, docx)!');
  }
}

// --- Routes ---

// Test Route
app.get('/api/ping', (req, res) => res.json({ msg: 'Backend pong from EC2! User API is live.' }));

// 1. User Registration (POST /api/users/register)
app.post(
  '/api/users/register',
  [
    body('username', 'Username is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName } = req.body;

    try {
      // Check if user exists (by email or username)
      let params = {
        TableName: dynamoDBTableName,
        IndexName: 'email-index', // Assuming you'll create a GSI on email
        KeyConditionExpression: 'email = :email_val',
        ExpressionAttributeValues: { ':email_val': email },
      };
      let existingUser = await dynamodb.query(params).promise();
      if (existingUser.Items.length > 0) {
        return res.status(400).json({ msg: 'User with this email already exists' });
      }
      // You might want a similar check for username if it should be unique

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = {
        userId: Date.now().toString(), // Simple unique ID
        username,
        email,
        password: hashedPassword,
        firstName: firstName || '',
        lastName: lastName || '',
        profilePictureUrl: '', // To be updated after S3 upload
        createdAt: new Date().toISOString(),
      };

      params = {
        TableName: dynamoDBTableName,
        Item: newUser,
      };
      await dynamodb.put(params).promise();

      // Return JWT
      const payload = { user: { id: newUser.userId, email: newUser.email } };
      jwt.sign(payload, jwtSecret, { expiresIn: '5h' }, (err, token) => {
        if (err) throw err;
        res.json({ token, user: { id: newUser.userId, username: newUser.username, email: newUser.email, profilePictureUrl: newUser.profilePictureUrl } });
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error during registration');
    }
  }
);

// 2. User Login (POST /api/users/login)
app.post(
  '/api/users/login',
  [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Find user by email (using GSI)
      const params = {
        TableName: dynamoDBTableName,
        IndexName: 'email-index', // Ensure this GSI exists
        KeyConditionExpression: 'email = :email_val',
        ExpressionAttributeValues: { ':email_val': email },
      };
      const data = await dynamodb.query(params).promise();

      if (data.Items.length === 0) {
        return res.status(400).json({ msg: 'Invalid credentials (user not found)' });
      }
      const user = data.Items[0];

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: 'Invalid credentials (password mismatch)' });
      }

      const payload = { user: { id: user.userId, email: user.email } };
      jwt.sign(payload, jwtSecret, { expiresIn: '5h' }, (err, token) => {
        if (err) throw err;
        res.json({ token, user: { id: user.userId, username: user.username, email: user.email, profilePictureUrl: user.profilePictureUrl, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error during login');
    }
  }
);

// 3. Get Current Authenticated User (GET /api/users/me)
app.get('/api/users/me', authMiddleware, async (req, res) => {
  try {
    const params = {
      TableName: dynamoDBTableName,
      Key: { userId: req.user.id }, // Assuming 'userId' is the primary partition key
    };
    const data = await dynamodb.get(params).promise();
    if (!data.Item) {
      return res.status(404).json({ msg: 'User not found' });
    }
    // Exclude password from the response
    const { password, ...userData } = data.Item;
    res.json(userData);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// 4. Update User Profile (PUT /api/users/me) - including profile picture
// This endpoint handles both text data and an optional file upload
app.put('/api/users/me', authMiddleware, upload.single('profilePicture'), async (req, res) => {
  const { firstName, lastName, username } = req.body;
  const updateExpressionParts = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {}; // For attribute names that are reserved keywords

  if (firstName) {
    updateExpressionParts.push('#fn = :fn');
    expressionAttributeNames['#fn'] = 'firstName';
    expressionAttributeValues[':fn'] = firstName;
  }
  if (lastName) {
    updateExpressionParts.push('#ln = :ln');
    expressionAttributeNames['#ln'] = 'lastName';
    expressionAttributeValues[':ln'] = lastName;
  }
  if (username) {
    updateExpressionParts.push('#un = :un');
    expressionAttributeNames['#un'] = 'username';
    expressionAttributeValues[':un'] = username;
  }
  // If a file was uploaded, req.file will be populated by multer-s3
  if (req.file && req.file.location) {
    updateExpressionParts.push('profilePictureUrl = :ppu');
    expressionAttributeValues[':ppu'] = req.file.location; // This is the S3 URL
  }

  if (updateExpressionParts.length === 0) {
    return res.status(400).json({ msg: 'No update fields provided' });
  }

  const params = {
    TableName: dynamoDBTableName,
    Key: { userId: req.user.id },
    UpdateExpression: `SET ${updateExpressionParts.join(', ')}, updatedAt = :ua`,
    ExpressionAttributeValues: { ...expressionAttributeValues, ':ua': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  };
   // Add ExpressionAttributeNames only if it's not empty
  if (Object.keys(expressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }


  try {
    const data = await dynamodb.update(params).promise();
    const { password, ...userData } = data.Attributes;
    res.json(userData);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error updating profile');
  }
});

// 5. Get User by ID (Publicly accessible, or use authMiddleware if private)
app.get('/api/users/:userId', async (req, res) => {
  try {
    const params = {
      TableName: dynamoDBTableName,
      Key: { userId: req.params.userId },
    };
    const data = await dynamodb.get(params).promise();
    if (!data.Item) {
      return res.status(404).json({ msg: 'User not found' });
    }
    const { password, ...userData } = data.Item;
    res.json(userData);
  } catch (err) {
    console.error(err.message);
    if (err.code === 'ResourceNotFoundException' || err.statusCode === 400) { // Better error handling for invalid ID format
         return res.status(404).json({ msg: 'User not found or invalid ID format' });
    }
    res.status(500).send('Server Error');
  }
});

// 6. Get All Users (Example - consider pagination for real apps)
app.get('/api/users', async (req, res) => { // Add authMiddleware if this should be protected
    try {
        const params = {
            TableName: dynamoDBTableName,
            // Add projection expression to exclude password if desired
            // ProjectionExpression: "userId, username, email, firstName, lastName, profilePictureUrl, createdAt"
        };
        const data = await dynamodb.scan(params).promise();
        // Important: Manually filter out passwords if not using ProjectionExpression
        const users = data.Items.map(user => {
            const { password, ...userData } = user;
            return userData;
        });
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 7. Delete User (Protected: only self or admin)
app.delete('/api/users/me', authMiddleware, async (req, res) => {
    try {
        // Optional: Delete user's S3 files if necessary (more complex)

        const params = {
            TableName: dynamoDBTableName,
            Key: { userId: req.user.id },
        };
        await dynamodb.delete(params).promise();
        res.json({ msg: 'User deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Simple Entity CRUD (e.g., "Posts" or "Tasks") ---
// Let's define a "Task" entity for CRUD example
// Attributes: taskId (PK), userId (GSI, to link to user), title, description, status, createdAt, updatedAt

// Create Task
app.post('/api/tasks', authMiddleware, [
    body('title', 'Title is required').not().isEmpty(),
    body('description', 'Description is required').not().isEmpty(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { title, description } = req.body;
    try {
        const newTask = {
            taskId: Date.now().toString() + Math.random().toString(16).slice(2), // unique enough for example
            userId: req.user.id, // Link to the logged-in user
            title,
            description,
            status: 'pending', // default status
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const params = { TableName: dynamoDBTasksTableName + '-tasks', Item: newTask }; // Use a separate table or append to user item
        await dynamodb.put(params).promise();
        res.json(newTask);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error creating task');
    }
});

// Get All Tasks for User
app.get('/api/tasks', authMiddleware, async (req, res) => {
    try {
        const params = {
            TableName: dynamoDBTasksTableName + '-tasks',
            IndexName: 'userId-index', // Requires a GSI on userId for the tasks table
            KeyConditionExpression: 'userId = :uid',
            ExpressionAttributeValues: { ':uid': req.user.id }
        };
        const data = await dynamodb.query(params).promise();
        res.json(data.Items);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error fetching tasks');
    }
});

// Get Task by ID
app.get('/api/tasks/:taskId', authMiddleware, async (req, res) => {
    try {
        const params = {
            TableName: dynamoDBTasksTableName + '-tasks',
            Key: { taskId: req.params.taskId }
        };
        const data = await dynamodb.get(params).promise();
        if (!data.Item || data.Item.userId !== req.user.id) { // Ensure user owns the task
            return res.status(404).json({ msg: 'Task not found or unauthorized' });
        }
        res.json(data.Item);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error fetching task');
    }
});

// Update Task
app.put('/api/tasks/:taskId', authMiddleware, [
  body('title', 'Title is required').optional().not().isEmpty(),
  body('description', 'Description is required').optional().not().isEmpty(),
  body('status', 'Invalid status').optional().isIn(['pending', 'inprogress', 'completed'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, status } = req.body;
    const updateExpressionParts = [];
    const expressionAttributeValues = { ':uid': req.user.id }; // For condition expression
    const expressionAttributeNames = {};

    // Check if task exists and belongs to user first
    try {
        const getParams = {
            TableName: dynamoDBTasksTableName + '-tasks',
            Key: { taskId: req.params.taskId }
        };
        const taskData = await dynamodb.get(getParams).promise();
        if (!taskData.Item || taskData.Item.userId !== req.user.id) {
            return res.status(404).json({ msg: 'Task not found or unauthorized' });
        }
    } catch (err) {
        console.error("Error fetching task for update check:", err.message);
        return res.status(500).send('Server Error during update pre-check');
    }


    if (title) {
        updateExpressionParts.push('#ttl = :ttl'); // #ttl is a placeholder for 'title'
        expressionAttributeNames['#ttl'] = 'title'; // Define that #ttl means 'title'
        expressionAttributeValues[':ttl'] = title;
    }
    if (description) {
        updateExpressionParts.push('#desc = :desc');
        expressionAttributeNames['#desc'] = 'description';
        expressionAttributeValues[':desc'] = description;
    }
    if (status) {
        updateExpressionParts.push('#sts = :sts');
        expressionAttributeNames['#sts'] = 'status';
        expressionAttributeValues[':sts'] = status;
    }

    if (updateExpressionParts.length === 0) {
        return res.status(400).json({ msg: 'No update fields provided for task' });
    }

    updateExpressionParts.push('updatedAt = :ua');
    expressionAttributeValues[':ua'] = new Date().toISOString();

    const params = {
        TableName: dynamoDBTasksTableName + '-tasks',
        Key: { taskId: req.params.taskId },
        UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
        ConditionExpression: 'userId = :uid', // Ensure user owns the task they're updating
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };

    try {
        const data = await dynamodb.update(params).promise();
        res.json(data.Attributes);
    } catch (err) {
        if (err.code === 'ConditionalCheckFailedException') {
            return res.status(403).json({ msg: 'Unauthorized to update this task or task does not exist.' });
        }
        console.error(err.message);
        res.status(500).send('Server Error updating task');
    }
});

// Delete Task
app.delete('/api/tasks/:taskId', authMiddleware, async (req, res) => {
    try {
        const params = {
            TableName: dynamoDBTasksTableName + '-tasks',
            Key: { taskId: req.params.taskId },
            ConditionExpression: 'userId = :uid', // Ensure user owns the task
            ExpressionAttributeValues: { ':uid': req.user.id }
        };
        await dynamodb.delete(params).promise();
        res.json({ msg: 'Task deleted' });
    } catch (err) {
        if (err.code === 'ConditionalCheckFailedException') {
            return res.status(403).json({ msg: 'Unauthorized to delete this task or task does not exist.' });
        }
        console.error(err.message);
        res.status(500).send('Server Error deleting task');
    }
});

module.exports = app; // Export app for server.js