'use strict';

// Module Dependencies
var express     		= require('express');
var bodyParser  		= require('body-parser');
var errorhandler 		= require('errorhandler');
var http        		= require('http');
const url 				= require('url');
var path        		= require('path');
var request     		= require('request');
var urlencodedparser 	= bodyParser.urlencoded({extended:false});
var app 				= express();
var Client 				= require('ssh2-sftp-client');
let sftp 				= new Client();
const axios 			= require('axios');
var csvWriter 			= require('csv-write-stream')
var writer 				= csvWriter()
var fs 					= require('fs');
var xml2js       		= require('xml2js');
var parser       		= new xml2js.Parser();
const process = require('process');
var returnedFiles;

let date_ob = new Date();
// current date
// adjust 0 before single digit date
let date = ("0" + date_ob.getDate()).slice(-2);
// current month
let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
// current year
let year = date_ob.getFullYear();
// current hours
let hours = date_ob.getHours();
// current minutes
let minutes = date_ob.getMinutes();
// current seconds
let seconds = date_ob.getSeconds();

let dateString = year + month + date + "_" + hours + minutes  + seconds;

// access Heroku variables
var marketingCloud = {
	sftpUrl: process.env.sftpUrl,
	sftpPort: process.env.sftpPort,
	sftpUser: process.env.sftpUser,
	sftpPassword: process.env.sftpPass
};

console.dir(marketingCloud);
console.log("Current working directory: ", process.cwd());

// Configure Express
app.set('port', process.env.PORT || 3000);
//app.use(express.static(path.join(__dirname, 'public')));

// Express in Development Mode
if ('development' == app.get('env')) {
	app.use(errorhandler());
}

function truncateString(str, num) {
	if (str.length <= num) {
	return str
	}
	return str.slice(0, num)
}

// listening port
http.createServer(app).listen(app.get('port'), function(){
	console.dir('Express server listening on port ' + app.get('port'));
});

app.get('/', (request, response) => response.send('Hello World!'));

async function getData(url) {
  try {
    const response = await axios.get("https://www." + url);
    const data = response.data;
    fs.writeFile('jobs_new.xml', data, function (err) {
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


async function parseXml() {

	try {
    	var xmlfile = "jobs_new.xml";
    	fs.readFile(xmlfile, "utf-8", function (error, text) {
        	if (!error) {

            	parser.parseString(text, function (err, result) {
                	console.dir(result);
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

					writer.pipe(fs.createWriteStream("jobs_feed.csv"));

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
                	console.dir(jobs[0]);

            	});

        	} else {
        		console.dir("there was an error generating the csv file");
        	}
        });
	} catch(error) {
		console.dir(error);
	}
}

async function sendFile(folder) {
	console.dir("Folder (185)");
	console.dir(folder);
	console.dir("Filename (187)");
	var ftpFile = "jobs_feed_" + dateString + ".csv";
	try {
		console.dir("making sftp connection");
		// access SFTP site
		sftp.connect({
			host: marketingCloud.sftpUrl,
			port: marketingCloud.sftpPort,
			username: marketingCloud.sftpUser,
			password: marketingCloud.sftpPassword
		}).then(() => {
			console.dir("Made connection");
			let remote = 'Import/' + folder + '/' + ftpFile;
			let data = fs.createReadStream(ftpFile);
			return sftp.put(data, remote);
		}).then(() => {
			return sftp.end();
		})
		.catch(err => {
			console.error(err.message);
		});

	} catch(e) {

	}
}

function fileList(dir) {
  return fs.readdirSync(dir).reduce(function(list, file) {
    var name = path.join(dir, file);
    var isDir = fs.statSync(name).isDirectory();
    return list.concat(isDir ? fileList(name) : [name]);
  }, []);
}

app.get('/save-xml/', async function(request, response) {

	const queryObject = url.parse(request.url,true).query;
	console.dir("URL is :");
	console.dir(queryObject.url);

	try {
		
		await getData(queryObject.url);
		const testFolder = './';
		const fs = require('fs');

		fs.readdir(testFolder, (err, files) => {
		  files.forEach(file => {
		    console.log(file);
		  });
		});
		response.send({"success": "true"});
	} catch(e) {
		response.send({"success": "false"});
		console.dir(e);
	}

});

app.get('/convert-csv/', async function(request, response) {

	try {
		
		await parseXml();
		response.send({"success": "true"});

		fs.readdir(testFolder, (err, files) => {
		  files.forEach(file => {
		    console.log(file);
		  });
		});
	} catch(e) {
		response.send({"success": "false"});
		console.dir(e);
	}

});

app.get('/sent-to-ftp/:folder/', async function(request, response) {

	try {
		
		await sendFile(request.params.folder);
		const testFolder = './';
		const fs = require('fs');

		response.send({"success": "true"});
		fs.readdir(testFolder, (err, files) => {
		  files.forEach(file => {
		    console.log(file);
		  });
		});
	} catch(e) {
		response.send({"success": "false"});
		console.dir(e);
	}

});
