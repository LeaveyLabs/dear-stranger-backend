/**
 * @fileoverview Server gateway.
 * @package
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const {v4: uuidv4} = require('uuid');
const {MongoClient} = require('mongodb');


const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
const mongoClient = new MongoClient(uri);
const port = process.env.PORT;
const adminUuid = process.env.ADMIN_UUID;

/**
 * An anonymous message.
 */
class Message {
  /**
   * @param {string} uuid UUID of this message.
   * @param {string?} inResponseTo UUID of the message being responded to.
   * @param {string} body Body of the message.
   * @param {number} timestamp Timestamp in seconds of the message.
   * @param {string} hue Id of the message mood color.
   * @param {string} senderUuid UUID of the sender.
   */
  constructor(uuid, inResponseTo, body, timestamp, hue, senderUuid) {
    this.uuid = uuid ? uuid : uuidv4();
    this.inResponseTo = inResponseTo;
    this.body = body;
    this.timestamp = timestamp;
    this.hue = hue;
    this.senderUuid = senderUuid;
  }
}

/**
 * Gets all messages in the database.
 * @return {[Message]} An array of messages.
 */
async function getAllMessages() {
  await mongoClient.connect();
  const dearStrangerClient = mongoClient.db(dbName);
  const messageCollection = dearStrangerClient.collection('messages');
  const messageCursor = messageCollection.find();
  const messages = [];
  await messageCursor.forEach((doc) => {
    messages.push(new Message(
        doc.uuid,
        doc.inResponseTo,
        doc.body,
        doc.timestamp,
        doc.hue,
        doc.senderUuid,
    ));
  });
  return messages;
}

/**
 * Adds a message to the database.
 * @param {Message} message Message to be added.
 */
async function addMessage(message) {
  await mongoClient.connect();
  const dearStrangerClient = mongoClient.db(dbName);
  const messageCollection = dearStrangerClient.collection('messages');
  await messageCollection.insertOne(message);
}

/**
 * One user reports an inappropriate letter.
 */
class Report {
  /**
   * @param {string} reporterUuid UUID of the reporter.
   * @param {string} letterUuid UUID of the reported letter.
   * @param {string} explanation Explanation for the report.
   */
  constructor(reporterUuid, letterUuid, explanation) {
    this.reporterUuid = reporterUuid;
    this.letterUuid = letterUuid;
    this.explanation = explanation;
  }
}

/**
 * Gets all reports.
 * @return {[Report]}
 */
async function getAllReports() {
  await mongoClient.connect();
  const dearStrangerClient = mongoClient.db(dbName);
  const reportCollection = dearStrangerClient.collection('reports');
  const reportCursor = reportCollection.find();
  const reports = [];
  await reportCursor.forEach((doc) => {
    reports.push(new Report(
        doc.reporterUuid,
        doc.letterUuid,
        doc.explanation,
    ));
  });
  return reports;
}

/**
 * Adds a report.
 * @param {Report} report Report to be added.
 */
async function addReport(report) {
  await mongoClient.connect();
  const dearStrangerClient = mongoClient.db(dbName);
  const reportCollection = dearStrangerClient.collection('reports');
  await reportCollection.insertOne(report);
}

/**
 * Deletes letter specificed by a UUID
 * @param {string} uuid UUID of the letter to be deleted.
 */
async function deleteLetter(uuid) {
  await mongoClient.connect();
  const dearStrangerClient = mongoClient.db(dbName);
  const messageCollection = dearStrangerClient.collection('messages');
  await messageCollection.deleteOne({'uuid': uuid});
}

/**
 * Returns whether a letter is beyond the report limit and should be deleted
 * @param {string} uuid UUID of a letter
 * @return {boolean}
 */
async function isBeyondReportLimit(uuid) {
  const reports = await getAllReports();
  let reportCount = 0;
  for (const report of reports) {
    if (report.letterUuid === uuid) {
      reportCount += 1;
    }
  }
  return reportCount > 3;
}

// Server Endpoints
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/', (_, response) => {
  response.send('Hello world!');
});

app.get('/messages', async (request, response) => {
  const messages = await getAllMessages();
  response.send(messages);
});

app.post('/messages', async (request, response) => {
  const message = new Message(
      request.body.uuid,
      request.body.inResponseTo,
      request.body.body,
      request.body.timestamp,
      request.body.hue,
      request.body.senderUuid,
  );
  await addMessage(message);
  response.send(message);
});

app.get('/reports', async (request, response) => {
  response.send(await getAllReports());
});

app.post('/reports', async (request, response) => {
  const report = new Report(
      request.body.reporterUuid,
      request.body.letterUuid,
      request.body.explanation,
  );

  await addReport(report);

  const isAdminReport = request.body.reporterUuid == adminUuid;
  const isBeyondLimit = await isBeyondReportLimit(request.body.letterUuid);

  if (isAdminReport || isBeyondLimit) {
    await deleteLetter(uuid);
  }

  response.send(report);
});

app.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err);
  }

  console.log(`server is listening on ${port}`);
});
