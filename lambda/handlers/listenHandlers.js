const Alexa = require('alexa-sdk');
const _ = require('lodash');
const constants = require('../constants/constants');

const ping = '<audio src="https://s3.amazonaws.com/dkohlruss/ping.mp3" />';

// DB constants
const AWS1 = require('aws-sdk');
const doc = new AWS1.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});

const listenHandlers = Alexa.CreateStateHandler(constants.states.LISTENING, {
  'LaunchRequest': function() {
    console.log('LISTENING LAUNCHREQUEST');
    this.handler.state = constants.states.MAIN;
    this.emitWithState('LaunchRequest');
  },

  'ListenIntent': function() {
    console.log('LISTENING LISTENINTENT');
    let lngEast = this.attributes['area'].east;
    let lngWest = this.attributes['area'].west;

    let params = {
      TableName: constants.confessionDBTableName,
      IndexName: 'ConfessionByLng',
      KeyConditionExpression: '#primarykey = :primarykeyval AND #sortkeyname between :west and :east',
      ExpressionAttributeNames: {
        '#primarykey': 'live',
        '#sortkeyname': 'lng',
      },
      ExpressionAttributeValues: {
        ':primarykeyval': 'yes',
        ':east': lngEast,
        ':west': lngWest
      },
      Limit: 50,
      ScanIndexForward: false
    }
    // Queries the database with the set parameters (within the area between east & west longitudinal values)
    doc.query(params, (err, data) => {
      if (err) {
        console.log('Get error: ' + JSON.stringify(err, null, 4));
      } else {
        let quotes = data.Items;
        let latNorth = this.attributes['area'].north;
        let latSouth = this.attributes['area'].south;

        // Filters the response (data) within the latitudinal values on the user object within the database and sorts them by the post's "hotness"
        quotes = _.filter(quotes, function(obj) {
              return (obj.lat <= latNorth && obj.lat >= latSouth);
            });
        quotes = _.sortBy(quotes, [function(obj) { return obj.hotness; }]);
        quotes = quotes.reverse();

        let listenedArr = this.attributes['listened'];
        for (let i = 0; i < quotes.length; i++) {
          if (listenedArr.indexOf(quotes[i].Id) === -1) {
            // Add Id to user's listened array, set user's confessionNum to Id, play quote, and send to voting
            listenedArr.push(quotes[i].Id);
            this.attributes['confessionNum'] = quotes[i].Id;
            let quote = quotes[i].quote;

            this.handler.state = constants.states.VOTING;
            this.emit(':ask', `Here is your Post: ${ping} ${quote} <break /> ${ping} <break />
                        Would you like to upvote or downvote this post.`, `Would you like to upvote
                        or downvote the post you just heard?`);
            break;
          }
        }
        this.handler.state = constants.states.MAIN;
        this.emit(':ask', `You've listened to all available posts.  Please try again later.  Main menu:
                  Would you like to listen to a post, submit a post, or get help with additional options?`,
                  `You can listen to a post, submit a post, or ask for help.`);
      }
    });
  },

  'MenuIntent': function() {
    console.log('LISTENING MENUINTENT');
    this.handler.state = constants.states.MAIN;
    this.emitWithState('MenuIntent');
  },

  'AMAZON.StopIntent': function() {
    console.log('LISTENING STOPINTENT');
    // State automatically saved with tell emit
    this.emit(':tell', 'Goodbye!');
  },

  'AMAZON.CancelIntent': function() {
    console.log('LISTENING CANCELINTENT');
    this.handler.state = constants.states.MAIN;
    this.emitWithState('MenuIntent');
  },

  'SessionEndedRequest': function() {
    console.log('LISTENING USER TIMED OUT');
    // Will save the state when user times out
    this.emit(':saveState', false);
  },

  'AMAZON.HelpIntent': function() {
    console.log('LISTENING HELPINTENT');
    this.emit(':ask', `You are currently listening to posts. You can either listen to a
              post, or return to the Main Menu.`, `The commands available to you are:
              listen, and main menu. You can exit at any time by saying: stop`);
  },

  'Unhandled': function() {
    console.log('LISTENING UNHANDLED');
    this.emitWithState('AMAZON.HelpIntent');
  }

});


module.exports = listenHandlers;
