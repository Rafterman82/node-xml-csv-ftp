'use strict';

// Module Dependencies
var express     		= require('express');
var bodyParser  		= require('body-parser');
var errorhandler 		= require('errorhandler');
var http        		= require('http');
var path        		= require('path');
var request     		= require('request');
var urlencodedparser 	= bodyParser.urlencoded({extended:false});
var app 				= express();
var Client 				= require('ssh2-sftp-client');
let sftp 				= new Client();
var returnedFiles;
const axios 			= require('axios');
var csvWriter = require('csv-write-stream')
var writer = csvWriter()

var fs = require('fs');
var xml2js       = require('xml2js');
var parser       = new xml2js.Parser();

// access Heroku variables
var marketingCloud = {
  sftpUrl: process.env.sftpUrl,
  sftpPort: process.env.sftpPort,
  sftpUser: process.env.sftpUser,
  sftpPassword: process.env.sftpPass,
  xmlUrl: process.env.xmlUrl
};

console.dir(marketingCloud);

// Configure Express
app.set('port', process.env.PORT || 3000);
//app.use(express.static(path.join(__dirname, 'public')));

// Express in Development Mode
if ('development' == app.get('env')) {
	app.use(errorhandler());
}

function truncateString(str, num) {
  // If the length of str is less than or equal to num
  // just return str--don't truncate it.
  if (str.length <= num) {
    return str
  }
  // Return str truncated with '...' concatenated to the end of str.
  return str.slice(0, num)
}


// listening port
http.createServer(app).listen(app.get('port'), function(){
	console.dir('Express server listening on port ' + app.get('port'));
});

app.get('/', (request, response) => response.send('Hello World!'));

const url = "https://www.michaelpage.pl/sites/michaelpage.pl/files/reports/job_advert_xml/jobs.xml";

const getData = async url => {
  try {
    const response = await axios.get(url);
    const data = response.data;
    fs.writeFile('testFile.xml', data, function (err) {
  		if (err) {
  			return console.log(err);
  		} else {
  			console.dir('File Written');
  		}
	});
    //console.dir(data);
  } catch (error) {
    console.dir(error);
  }
};


const parseXml = async payload => {
	try {
    	var xmlfile = __dirname + "/testFile.xml";
    	fs.readFile(xmlfile, "utf-8", function (error, text) {
        	if (error) {
            	throw error;
        	} else {
            	parser.parseString(text, function (err, result) {
                	//console.dir(result.jobs.job);
                	//console.dir(result.jobs.job.length);
                	var jobsObject = result.jobs.job;

                	var jobs = [];

                	var writer = csvWriter({ 
                		separator: '|',
                		headers: [
                			"uniqueJobID",
                			"ref",
                			"brand",
                			"title",
                			"language",
                			"country",
                			"contractType",
                			"active",
                			"published",
                			"salary_max",
                			"salary_min",
                			"salary_show",
                			"content",
                			"status",
                			"updated",
                			"bulletPoints_0",
                			"bulletPoints_1",
                			"spare_title_1",
                			"spare_title_2",
                			"location_code",
                			"location_text",
                			"location_term",
                			"location_spare",
                			"job_detail_url"
                		]
                	})
					writer.pipe(fs.createWriteStream('out.csv'));
		truncateString("A-tisket a-tasket A green and yellow basket", 8);
					

                	for ( var i = 0; i < jobsObject.length; i++) {
                		if ( jobsObject[i] ) {

                			jobs[i] = {
                				"uniqueJobID": 		jobsObject[i].uniqueJobID[0],
		                		"ref": 				jobsObject[i].ref[0],
		                		"brand": 			jobsObject[i].brand[0],
		                		"title": 			jobsObject[i].title[0],
		                		"language": 		jobsObject[i].language[0],
		                		"country": 			jobsObject[i].country[0],
		                		"contractType": 	jobsObject[i].contractType[0],
		                		"active": 			jobsObject[i].active[0],
		                		"published": 		jobsObject[i].published[0],
		                		"salary_max": 		jobsObject[i].salary[0].max[0],
		                		"salary_min": 		jobsObject[i].salary[0].min[0],
		                		"salary_show": 		jobsObject[i].salary[0].show[0],
		                		"content": 			truncateString(jobsObject[i].summary[0].content[0], 4000),
		                		"status": 			jobsObject[i].status[0],
		                		"updated": 			jobsObject[i].updated[0],
		                		"bulletPoints_0": 	jobsObject[i].description[0].bulletPoints[0].bulletPoints_0[0],
		                		"bulletPoints_1": 	jobsObject[i].description[0].bulletPoints[0].bulletPoints_1[0],
		                		"spare_title_1": 	jobsObject[i].title[0],
		                		"spare_title_2": 	jobsObject[i].title[0],
		                		"location_code": 	jobsObject[i].location[0].code[0],
		                		"location_text": 	jobsObject[i].location[0].text[0],
		                		"location_term": 	jobsObject[i].location[0].term[0],
		                		"location_spare":   jobsObject[i].location[0].text[0],
		                		"job_detail_url":   jobsObject[i].Job_Detail_URL[0],

                			}
                			writer.write(jobs[i]);
                		}


                	}
                	writer.end();
                	console.dir(jobs);


            	});
        	}
        });

	} catch(error) {
		console.dir(error);
	}
}

app.get('/readFtpFolder/:folder/:filename/', async function(request, response) {

	console.dir("Folder is " + request.params.folder + " | Filename I will use is " + request.params.filename);
	const getXmlJobsFile = await getData(url);
	const parseThisXml = await parseXml(getXmlJobsFile);
	
	response.send({"success": "true"});


	// access SFTP site
	
	sftp.connect({
		host: marketingCloud.sftpUrl,
		port: marketingCloud.sftpPort,
		username: marketingCloud.sftpUser,
		password: marketingCloud.sftpPassword
	}).then(() => {
		return sftp.list("/Import/" + req.params.folder);
	}).then(response => {
		//console.log(data, 'the data info');
		console.dir(response);
		//console.dir("Filename is " + response[0]['name']);
		// loop through results, make sure
		var highestTimestamp = 0;
		var fileName;
		var i = 0 ;
		for ( i = 0; i < response.length; i++ ) {
			console.dir("Filename is " + response[i]['name']);
			console.dir("Timestamp for this row " + response[i]['modifyTime']);

			if ( response[i]['modifyTime'] > highestTimestamp ) {
	        	highestTimestamp = response[i]['modifyTime'];
	        	
	        	console.dir(response[i]['name']);
	        	fileName = response[i]['name'];
	    	}
	    	console.dir("Current highest timestamp is " + highestTimestamp);
	    	console.dir(highestTimestamp);
		}
		sftp.end();
		console.dir("Filename with highest timestamp is " + fileName);
		res.send(fileName);


	}).catch(err => {
		sftp.end();
		console.log(err, 'catch error');
	});

	
	return fileName;


});
