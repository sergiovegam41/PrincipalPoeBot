require('dotenv').config()
const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const axios = require('axios');


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());
const cors = require('cors')

const { MongoClient, ServerApiVersion } = require('mongodb');
const DATABASE = process.env.MONGO_DATABASE || "Bots"
const uriMongo = process.env.MONGO_URI;
const Mongoclient = new MongoClient(uriMongo, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
var ApisPoeClientAvailableCollection = null
var poeTokensAvailableCollection = null
var poeTokensNOTAvailableCollection = null

var UsersCollection = null
var DefaultsProntsCollection = null

Mongoclient.connect(async err => {

  ApisPoeClientAvailableCollection = Mongoclient.db(DATABASE).collection("ApisPoeClientAvailable");
  poeTokensAvailableCollection = Mongoclient.db(DATABASE).collection("poeTokensAvailable");
  poeTokensNOTAvailableCollection = Mongoclient.db(DATABASE).collection("poeTokensNOTAvailable");
  UsersCollection = Mongoclient.db(DATABASE).collection("IAUsers");
  DefaultsProntsCollection = Mongoclient.db(DATABASE).collection("DefaultsPronts");

  if (err) { console.log(err) } else {
    this.ready = true
  }

  console.log("Mongo Conectado a: " + DATABASE);

  const server = app.listen(port, () => {

    console.log(`La aplicación está corriendo en el puerto: ${port}`);
    // console.log(`Api ready.`)
  })

});

const corsOptions = {
  origin: '*', // dominio permitido
  methods: ['GET', 'POST', 'PUT'] // métodos HTTP permitidos
};

app.use(cors(corsOptions));

const TOKEN_PASSWORD = process.env.TOKEN_PASSWORD
const port = process.env.PORT || 3000
// QRPortalWeb()

app.get('/ping', async function (req, res) {
  await pingToPoeClients()
  return res.send(true)
})

app.post('/send', async function (req, res) {

  let defaultProntID = req.body.defaultProntID || null
  let poeToken = req.body.poeToken || null
  let phone = req.body.phone || null
  let token = req.body.token || ""
  let message = req.body.message || ""
  let purge = req.body.purge || false
  let bot = req.body.bot || "a2"
  bot = bot.toLowerCase()

  if (!hasAuthority(token)) return res.send({
    success: false,
    message: "UNAUTHORIZED",
  })

  if (!message) return res.send({
    success: false,
    message: "MESSAGE_IS_REQUIRED",
  })

  const patronPhone = /^[0-9]{14}$/;

  console.log(patronPhone.test(phone))

  if (patronPhone.test(phone) || phone == null) return res.send({
    success: false,
    message: "PHONE_INVALID_OR_NULL",
  })



  try {

    let user = await searchOrCreateUserByPhone(phone)
    let hostApi = await selectRamDomHostAvailable()
    console.log(hostApi.host)

    let useDetultPront = defaultProntID == null? false: true

    let changued = false
    if(((user.useDetultPront||false == true ) != (useDetultPront == true) ) || user.defaultProntID != defaultProntID ){
      purge = true
      changued = true;
    }
    
    if(useDetultPront){
      
      const defaultPront = await DefaultsProntsCollection.findOne({ id: defaultProntID});

      let minutes = getMinutesSinceLastTime(user.lastTime)

      if( changued || (minutes >= defaultPront.TimeOut ) || purge ){
        
        purge = true
        message = defaultPront.pront+"\n---\n"+message
        console.log("Purgado")  

      }


    }

    console.log("antes de sendMessageToApi")
    let body = {
      token: hostApi.auth,
      poeToken: poeToken == null ? user.poeToken : poeToken,
      message: message,
      purge: purge,
      bot: bot
    }

    let reply = await sendToApi(hostApi.host, body)

    await UsersCollection.updateOne({ phone }, { $set: { lastTime: new Date(), useDetultPront, defaultProntID } });
    
    return res.send({
      success: true,
      message: "OK",
      data: {
        message: reply.data.message.trim()
      }
    })

  } catch (error) {

    return res.send({
      success: false,
      message: error,
    })

  }

});


app.post('/purge', async function (req, res) {

  let poeToken = req.body.poeToken || null
  let phone = req.body.phone || null
  let token = req.body.token || ""
  let message = req.body.message || ""
  let purge = req.body.purge || false
  let bot = req.body.bot || "a2"
  bot = bot.toLowerCase()

  if (!hasAuthority(token)) return res.send({
    success: false,
    message: "UNAUTHORIZED",
  })

  if (!message) return res.send({
    success: false,
    message: "MESSAGE_IS_REQUIRED",
  })

  const patronPhone = /^[0-9]{14}$/;

  console.log(patronPhone.test(phone))

  if (patronPhone.test(phone) || phone == null) return res.send({
    success: false,
    message: "PHONE_INVALID_OR_NULL",
  })

  try {

    let user = await searchOrCreateUserByPhone(phone)

    let hostApi = await selectRamDomHostAvailable()

    console.log(hostApi.host)
    console.log("antes de sendMessageToApi")
    let body = {
      token: hostApi.auth,
      poeToken: poeToken == null ? user.poeToken : poeToken,
      message: message,
      purge: purge,
      bot: bot
    }
    await sendToApi(hostApi.host, body, 'purge')
    

    // responder 
    res.send({
      success: true,
      message: "OK",
    })

  } catch (error) {

    return res.send({
      success: false,
      message: error,
    })

  }

});

app.post('/get-history', async function (req, res) {

  let poeToken = req.body.poeToken || null
  let phone = req.body.phone || null
  let token = req.body.token || ""
  let message = req.body.message || ""
  let purge = req.body.purge || false
  let bot = req.body.bot || "a2"
  bot = bot.toLowerCase()

  if (!hasAuthority(token)) return res.send({
    success: false,
    message: "UNAUTHORIZED",
  })

  const patronPhone = /^[0-9]{14}$/;

  if (patronPhone.test(phone) || (phone == null)) return res.send({
    success: false,
    message: "PHONE_INVALID_OR_NULL",
  })

  try {

    let user = await searchOrCreateUserByPhone(phone)

    let hostApi = await selectRamDomHostAvailable()

    console.log(hostApi.host)
    console.log("antes de sendMessageToApi")
    let body = {
      token: hostApi.auth,
      poeToken: poeToken == null ? user.poeToken : poeToken,
      message: message,
      purge: purge,
      bot: bot
    }
    let reply = await sendToApi(hostApi.host, body, 'get-history')

    // responder 
    res.send({
      success: true,
      message: "OK",
      data: {
        message: reply.data
      }
    })

  } catch (error) {

    return res.send({
      success: false,
      message: error,
    })

  }

});

app.post('/get-token', async function (req, res) {

  let token = req.body.token || ""

  if (!hasAuthority(token)) return res.send({
    success: false,
    message: "UNAUTHORIZED",
  })

  res.send({
    success: true,
    message: "OK",
    data: {
      token: await getTokenPoe()
    }
  })

});

app.post('/set-token', async function (req, res) {

  let token = req.body.token || ""
  let poeToken = req.body.poeToken || null


  if (!hasAuthority(token)) return res.send({
    success: false,
    message: "UNAUTHORIZED",
  })

 await setTokenPoe(poeToken)

    res.send({
      success: true,
      message: "OK"
    })

});

app.post('/bot-list', async function (req, res) {

  let poeToken = req.body.poeToken || null
  let phone = req.body.phone || null
  let token = req.body.token || ""
  let message = req.body.message || ""
  let purge = req.body.purge || false
  let bot = req.body.bot || "a2"
  bot = bot.toLowerCase()

  if (!hasAuthority(token)) return res.send({
    success: false,
    message: "UNAUTHORIZED",
  })

  const patronPhone = /^[0-9]{14}$/;

  if (patronPhone.test(phone) || phone == null) return res.send({
    success: false,
    message: "PHONE_INVALID_OR_NULL",
  })

  try {

    let user = await searchOrCreateUserByPhone(phone)

    let hostApi = await selectRamDomHostAvailable()

    console.log(hostApi.host)
    console.log("antes de sendMessageToApi")
    let body = {
      token: hostApi.auth,
      poeToken: poeToken == null ? user.poeToken : poeToken,
      message: message,
      purge: purge,
      bot: bot
    }
    let reply = await sendToApi(hostApi.host, body, 'bot-list')

    // responder 
    res.send({
      success: true,
      message: "OK",
      data: {
        message: reply.data
      }
    })

  } catch (error) {

    return res.send({
      success: false,
      message: error,
    })

  }

});


function hasAuthority(token) {
  return !(token != TOKEN_PASSWORD && process.env.APP_MODE == "PROD" && TOKEN_PASSWORD != null)
}



async function sendToApi(host, body, action = 'send') {
  // console.log("Run sendMessageToApi")
  // console.log(body)
  try {
    const response = await axios.post(`${host}/${action}`, body);
    // console.log(response.data)

    return response.data;

  } catch (error) {
    throw error;
  }
}

app.get('/redirect-host', async function (req, res) {


  res.redirect((await selectRamDomHostAvailable()).host);
  // res.send({
  //   success: true,
  //   message: "OK",
  //   data: {
  //     host: 
  //   }
  // })

});


app.post('/get-host', async function (req, res) {

  let token = req.body.token || ""

  if (!hasAuthority(token)) return res.send({
    success: false,
    message: "UNAUTHORIZED",
  })

  res.send({
    success: true,
    message: "OK",
    data: {
      host: await selectRamDomHostAvailable()
    }
  })

});
async function selectRamDomHostAvailable() {
  const activeHosts = await ApisPoeClientAvailableCollection.find({ active: true }).toArray();
  const randomHost = activeHosts[Math.floor(Math.random() * activeHosts.length)];
  return randomHost;
}


async function pingToPoeClients() {
  const activeHosts = await ApisPoeClientAvailableCollection.find().toArray();

  for (let host of activeHosts) {
    try {
      let resp = await axios.get(`${host.host}/ping`);
      console.log(resp.data);
    } catch (error) {
      console.log(false);
    }
  }

  return true;
}

async function searchOrCreateUserByPhone(phone) {
  const user = await UsersCollection.findOne({ phone });
  if (!user) {
    const newUser = {
      phone,
      poeToken: await getTokenPoe()
    };
    await UsersCollection.insertOne(newUser);
    return await UsersCollection.findOne({ phone });
  }
  return user;
}

async function getTokenPoe() {
    let token = await poeTokensAvailableCollection.findOne();
    console.log(`[TOKEN_TAKEN]: ${token.token}`)
    await poeTokensAvailableCollection.deleteOne({ _id: token._id });
    await poeTokensNOTAvailableCollection.insertOne({ token: token.token});

    return token.token;
}

async function setTokenPoe(token) {
    // console.log(token)
    let tokenFind = await poeTokensNOTAvailableCollection.findOne({token: token});

    if(token){
        console.log(`[TOKEN_RETURNED]: ${tokenFind.token}`)

        await poeTokensNOTAvailableCollection.deleteOne({ _id: tokenFind._id });
        await poeTokensAvailableCollection.insertOne({ token: token});
    }
    return token;
}



function getMinutesSinceLastTime (lastTime) {
  const now = new Date();
  if (!lastTime) {
    lastTime = now;
    return 0;
  } else {
    const diff = (now - lastTime) / 1000 / 60;
    lastTime = now;
    return Math.floor(diff);
  }
}