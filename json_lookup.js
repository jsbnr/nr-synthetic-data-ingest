/*
* Utils and common settings
*/


const NAMESPACE="jsonlookup" //change this to whatever is menaingful to uo
const DEFAULT_TIMEOUT = 5000  //time to wait before giving up on an http request
const METRIC_API = "https://metric-api.newrelic.com/metric/v1" //Which NR API to send metric data to (US data centre)

// Note: you should have a secure credential called "JSON_LOOKUP_INSERT_KEY" that contains an insights insert API key. Idf testing locally temporarily provide it in the configuration below.



const assert = require('assert')
let RUNNING_LOCALLY = false

/*
*  ========== LOCAL TESTING CONFIGURATION ===========================
*  This section allows you to run the script from your local machine
*  mimicking it running in the new relic environment. Much easier to develop!
*/


const IS_LOCAL_ENV = typeof $http === 'undefined';
if (IS_LOCAL_ENV) {  
  RUNNING_LOCALLY=true
  var $http = require("request");       
  var $secure = {}   
  //$secure.JSON_LOOKUP_INSERT_KEY = "your-key-here-only-when-testing"              
  var $env = {}
  $env.LOCATION="local"
  console.log("Running in local mode")
} 
// ========== END LOCAL TESTING CONFIGURATION ==========================

const INSERT_KEY=$secure.JSON_LOOKUP_INSERT_KEY

/*
* setAttribute()
* Sets a custom attribute on the synthetic record
*
* @param {string} key               - the key name
* @param {Strin|Object} value       - the value to set
*/
const setAttribute = function(key,value) {
    if(!RUNNING_LOCALLY) { //these only make sense when running on a minion
        $util.insights.set(key,value)
    } else {
        console.log(`[LOCAL] Set attribute '${key}' to ${value}`)
    }
}


/*
* genericServiceCall()
* Generic service call helper for commonly repeated tasks
*
* @param {number} responseCodes  - The response code (or array of codes) expected from the api call (e.g. 200 or [200,201])
* @param {Object} options       - The standard http request options object
* @param {function} success     - Call back function to run on successfule request
*/
const  genericServiceCall = function(responseCodes,options,success) {
    !('timeout' in options) && (options.timeout = DEFAULT_TIMEOUT) //add a timeout if not already specified 
    let possibleResponseCodes=responseCodes
    if(typeof(responseCodes) == 'number') { //convert to array if not supplied as array
      possibleResponseCodes=[responseCodes]
    }
    return new Promise((resolve, reject) => {
        $http(options, function callback(error, response, body) {
        if(error) {
            reject(`Connection error on url '${options.url}'`)
        } else {
            if(!possibleResponseCodes.includes(response.statusCode)) {
                let errmsg=`Expected [${possibleResponseCodes}] response code but got '${response.statusCode}' from url '${options.url}'`
                reject(errmsg)
            } else {
                resolve(success(body,response,error))
            }
          }
        });
    })
  }


/*
* sendDataToNewRelic()
* Sends a metrics payload to New Relic
*
* @param {object} data               - the payload to send
*/
const sendDataToNewRelic = async (data) =>  {
    let request = {
        url: METRIC_API,
        method: 'POST',
        json: true,
        headers :{
            "Api-Key": INSERT_KEY
        },
        body: data
    }
    return genericServiceCall([200,202],request,(body,response,error)=>{
        if(error) {
            console.log(`NR Post failed : ${error} `)
            return false
        } else {
            return true
        }
        })
}


/*
* asyncForEach()
*
* A handy version of forEach that supports await.
* @param {Object[]} array     - An array of things to iterate over
* @param {function} callback  - The callback for each item
*/
async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }

/* Chunk array 
*/
function chunk_arr(inputArray,perChunk) {
    var perChunk = 2 // items per chunk    
    return inputArray.reduce((all,one,i) => {
        const ch = Math.floor(i/perChunk); 
        all[ch] = [].concat((all[ch]||[]),one); 
        return all
     }, [])
}


/* 
* Promise.allSettled polyfill
*/
const allSettled =  ((promises) => Promise.all(promises.map(p => p
    .then(value => ({
      status: 'fulfilled', value
    }))
    .catch(reason => ({
      status: 'rejected', reason
    }))
)));


/*
* End Utils Section
*/


// Script starts here!
async function run() {
    console.log('Start up')

    let request = {
        url: "https://run.mocky.io/v3/38fe4c3d-fc02-4d76-9af3-13d347c537fc",
        method: 'GET'
    }
    //This returns this mock data:
    // {
    //     "exampleValue": 25.8,
    //     "host" : "saturn",
    //     "region" :"eu-west-1a"
    // }

    let data = await genericServiceCall([200],request,(body,response,error)=>{
        if(error) {
            console.log(`Error: ${error}`)
            return false
        } else {
            try {
                let jsonData=JSON.parse(body)
                return jsonData
            } catch(error) {
                console.log(`JSON Conversion failed : ${error}`)
                return false
            }
        }
    })

    if(data ){

        let unixTimeNow=Math.round(Date.now()/1000)

        let metricsInnerPayload = [{
                name: `${NAMESPACE}.duration`,
                type: "gauge",
                value: data.exampleValue,
                timestamp: unixTimeNow,
                attributes: {
                    host: data.host,
                    region: data.region
                }
            }]

        let metricsPayLoad=[{ 
            common : {
                attributes: {
                    monitorId: $env.MONITOR_ID,
                    monitorLocation: $env.LOCATION
                }
            },
            "metrics": metricsInnerPayload
        }]

        let NRPostStatus = await sendDataToNewRelic(metricsPayLoad)
        if( NRPostStatus === true ){
           console.log("NR Post successful")   
        } else {
            assert.fail("NR Post failed")  
        }

    } else {
        assert.fail("Lookup failed")
    }


}

run()