const express = require('express');
var cookieParser = require('cookie-parser')
const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const throttle = require('express-throttle-bandwidth');
const helmet = require('helmet');
const xss = require('xss-clean');
const cors = require('cors');
const S3 = require('aws-sdk/clients/s3');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });
/*
const rateLimit = require('express-rate-limit');
const fsUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // allow max 20 upload requests from one IP
});
const fsViewLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 2000, // allow max 2000 view requests from one IP
});
*/
const app = express();

// set security HTTP headers
app.use(helmet());

// sanitize request data
app.use(xss());

// enable cors
app.use(cors());
app.options('*', cors());

// use the cookie parser
app.use(cookieParser())

const
  port = process.env.PORT || 4444,
  folder = path.join(__dirname, '/uploads')

if (!fs.existsSync(folder)) {
  fs.mkdirSync(folder)
}

app.set('port', port)
app.use(throttle(1024 * 1024 * 5)) // throttling bandwidth

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  // res.header('Access-Control-Allow-Credentials', true) // allow cookie creds?? https://stackoverflow.com/questions/46288437/set-cookies-for-cross-origin-requests
  next()
})

// check the token with the API server to see if the user is authenticated
const validateUser = async function (req, res, next) {
  // console.log("Middleware: " + req.originalUrl)
  try {
    headers = req.headers
    headers.Authorization = req.cookies.token
    // send the request headers as is to the API server
    const response = await axios.get(process.env.API_SERVER + '/user/validate', { headers: headers })
    // const response = {}; response.status = 204 // skip auth
    if (response.status == 204) { 
      // we should get a No-Content 204 if the user token is valid
      // console.log("Authenticated")
      // console.log(JSON.stringify(res))
      next()
    }else{
      // the token is not valid, whatever the response we send it back to the client
      res.send(response)
    }
  } catch (error) {
    next(error)
  }
}

app.get('/', function(req, res){
  res.send("GearMonkey File Server");
})

app.post('/upload', (req, res) => {
  console.log("============== Upload ==================")
  console.log(req.body)
  const form = new formidable.IncomingForm()
  const s3 = new S3({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET
  });    
  form.uploadDir = folder
  let uploadedFiles = []
  form.parse(req, async (_, fields, files) => {
    console.log("Parsed", fields)
    uploadedFiles = files

    // check file extension 
    var getfileextension = fields.name.split('.').pop().toLowerCase();
    console.log("file extension ", getfileextension)
    if(!(getfileextension == 'jpg' || getfileextension == 'png' || getfileextension == 'pdf' || getfileextension == 'xlsx' || getfileextension == 'csv')) {
      res.send({"status":` '${getfileextension}' file format not allowed`})
    }

    // console.log('Upload folder: ' + JSON.stringify(form.uploadDir))
    // console.log('Uploaded files: ' + JSON.stringify(uploadedFiles))
    // try the authentication and S3 upload only after all files have been received
    // trying to run form.parse async will cause race conditions (where file is not received bu we are attempting to upload)
    try {
      // send the request headers as is to the API server
      // const response = await axios.get(process.env.API_SERVER + '/user/validate', { headers: req.headers })
      const response = {}; response.status = 204 // skip auth
      if (response.status == 204) { 
        // we should get a No-Content 204 if the user token is valid
        console.log("Authenticated")
        Object.keys(uploadedFiles).forEach(function (fkey) {
          console.log(uploadedFiles[fkey])
          const item = uploadedFiles[fkey]
          key = path.basename(item.path) + "--" + fields.name
          console.log(key)
          // console.log("Key: " + key)
          // Read content from the file
          const itemContent = fs.readFileSync(item.path);
          // now delete the file
          fs.unlinkSync(item.path)
          // Setting up S3 upload parameters (to test: send in zero bytes or bucket name)
          const params = {
            Bucket: process.env.AWS_BUCKET, // bucket where to upload
            Key: key, // File name you want to save as in S3
            Body: itemContent // the actual file contents
          };
    
          // Uploading files to the bucket
          s3.upload(params, function(err, data) {
            if (err) {
              // res.send('Failed! - ' + JSON.stringify(err))
              res.status(500).json({ success: false, error: err, key: key, message: "Error while uploading file to AWS S3" })
              // throw err;
            }else{
              res.json({ success: true, data: data })
              // console.log(`File uploaded successfully: ${data.Location}`);
            }
          });
        })
      }else{
        // the token is not valid, whatever the response we send it back to the client
        res.send(response)
      }
    } catch (error) {
      // console.log('Error while trying to upload')
      res.status(500).json({ success: false, error: error, meesage: "Error while trying to upload" })
    }    
  })
})

app.get('/set-cookie', async (req, res) => {
  // console.log("============== Set Cookie ==================")
  // set the http-cookies for authenticating viewing files
  try {
    // send the request headers as is to the API server
    // const response = await axios.get(process.env.API_SERVER + '/user/validate', { headers: req.headers })
    const response = {}; response.status = 204 // skip auth
    if (response.status == 204) { 
      // we should get a No-Content 204 if the user token is valid
      // console.log("Authenticated and setting cookie" + req.header('Authorization'))
      // set the http-cookies for authenticating viewing files
      res.cookie('token', req.header('Authorization'), {
        // maxAge: 86400 * 1000, // 24 hours
        // httpOnly: true, // http only, prevents JavaScript cookie access
        // secure: true // cookie must be sent over https / ssl
      }).send()
    }else{
      // the token is not valid, whatever the response we send it back to the client
      res.send(response)
    }
  } catch (error) {
    // console.log('Error while trying to set cookie')
    res.status(500).json({ success: false, error: error, meesage: "Error while trying to set cookie" })
  }
})

app.get('/view/:key', async (req, res) => {
  // console.log("============== View ==================")
  // set the http-cookies for authenticating viewing files
  headers = req.headers
  if (req.cookies.token) {
    // console.log("Ready to authenticate using cookies") // + req.cookies.token)
    headers.Authorization = req.cookies.token
  }else{
    // console.log("Ready to authenticate using query") // + req.query.token)
    headers.Authorization = req.query.token
  }
  try {
    // get the request headers and add the token from http-cookies to the API server
    // const response = await axios.get(process.env.API_SERVER + '/user/validate', { headers: headers })
    const response = {}; response.status = 204 // skip auth
    if (response.status == 204) {
      // we should get a No-Content 204 if the user token is valid
      // console.log("Authenticated and key value exists")
      const s3 = new S3({
        accessKeyId: process.env.AWS_KEY,
        secretAccessKey: process.env.AWS_SECRET
      });    
    
      const params = {
        Bucket: process.env.AWS_BUCKET,
        Key: req.params.key,
      };
    
      // Fetch object from the bucket
      s3.getObject(params, function(err, data) {
        if (err) {
          // res.send('Failed! - ' + JSON.stringify(err))
          // console.log('Failed to get data from S3: ' + req.params.key + ' -- '+ JSON.stringify(err))
          res.status(500).json({ success: false, error: err, key: req.params.key, message: "Error while downloading file from AWS S3" })
          // throw err;
        }else{
          res.send(data.Body)
          // res.json({ success: true, data: data })
          // console.log(`File downloaded successfully: ${req.params.key}`);
        }
      });    
    }else{
      // the token is not valid, whatever the response we send it back to the client
      // console.log('Failed to authenticate')
      res.send(response)
    }
  } catch (error) {
    // console.log('Error while trying to view')
    res.status(500).json({ success: false, error: error, meesage: "Error while trying to view" })
  }
})

app.listen(port, () => {
  console.log('\nUpload server running on http://localhost:' + port)
})
