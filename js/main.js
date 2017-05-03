// process input text into the output image
function processText() {
	var input_text = document.getElementById("raw_text").value;
	if (input_text.length == 0) {
		alert("Please provide input");
		return;
	}
	
	// try to find the start of the schedule table.
	var start_find = '<table summary="Schedule">';
	var end_find = '</table>';
	var start_table_pos = input_text.indexOf(start_find);
	var start_endtable_pos = input_text.indexOf(end_find, start_table_pos);
	if (start_table_pos < 0 || start_endtable_pos < 0) {
		alert("Invalid input: No schedule found");
		return;
	}
	// shorten the amount we care about
	input_text = input_text.substr(start_table_pos, start_endtable_pos - start_table_pos);
	
	// extract the rows from the schedule gable.
	var schedule_rows_raw = []; 
	var next_tr = input_text.indexOf('<tr>');
	var next_endtr = input_text.indexOf('</tr>');
	var rowOn = 0;
	// go through each row
	while (next_tr >= 0 && next_endtr >= 0) {
		var curr_row_text = input_text.substr(next_tr + 4, next_endtr - next_tr - 5);
		schedule_rows_raw[ rowOn ] = [];   // make an array for columns
		
		// now go through each column
		var next_td = curr_row_text.indexOf('<td');
		var next_endtd = curr_row_text.indexOf('</td>');;
		var colOn = 0;
		while(next_td >= 0 && next_endtd >= 0) {
			schedule_rows_raw[ rowOn ][ colOn ] = curr_row_text.substr(next_td + 4, next_endtd - next_td - 5);
			next_td = curr_row_text.indexOf('<td', next_td + 4);
			next_endtd = curr_row_text.indexOf('</td>', next_endtd + 5);
			colOn++;
		}
		
		next_tr = input_text.indexOf('<tr>', next_tr + 4);
		next_endtr = input_text.indexOf('</tr>', next_endtr + 5);
		rowOn++;
	}
	
	var found_data_aux = [];  // array of objects containing the found data from this schedule
	// now we can process the columns for each row
	for (var r = 0; r < schedule_rows_raw.length; r++) {
		found_data_aux[r] = {name_str : "NOT_FOUND", time_place_str : "NOT_FOUND"};  // make a new object
		// Columns tagged with LIST_VAR6 have the course name
		// Columns taggged with LIST_VAR12 have the course time.
		for (var c = 0; c < schedule_rows_raw[r].length; c++) {
			var curr_str = schedule_rows_raw[r][c];
			if (curr_str.indexOf("LIST_VAR6") !== -1) {
				// find the start of the <a> tag, then find the end of that tag.
				var startOfName = curr_str.indexOf('>', curr_str.indexOf('<a')) + 1;
				var endOfName = curr_str.indexOf('</a>', startOfName);
				found_data_aux[r]['name_str'] = curr_str.substr(startOfName,  endOfName - startOfName);	;
			} else if (curr_str.indexOf("LIST_VAR12") !== -1) {
				var startOfTime = curr_str.indexOf('>', curr_str.indexOf('<p')) + 1;
				var endOfTime = curr_str.indexOf('</p>', startOfTime);
				found_data_aux[r]['time_place_str'] = curr_str.substr(startOfTime, endOfTime - startOfTime);
			}
		}
	}
	// trim down the found_data array to get rid of invalid rows
	var found_data = [];
	for (var i = 0; i < found_data_aux.length; i++) {
		if (found_data_aux[i].name_str != "NOT_FOUND" && 
			found_data_aux[i].time_place_str != "NOT_FOUND") {
			found_data.push(found_data_aux[i]);	
		}
	}
	
	// now we only have the strings that are important
	//console.log(found_data);
	
	// process the time_place_str 
	
	// name_str has the following format
	// COURSETYPE-NUMBER-SECTION (SYNONYM) Title of Course
	// time_place_str has the following format
	// DATE_START-DATE_END [Lecture] DAY[, DAY ...] TIME[AM|PM] - TIME[AM|PM], LOCATION, ROOM
	// we want to extract the day(s) of the week that the course takes place, as 
	// well as the time of instruction.
	
	// this can be more complicated with courses that have both labs and normal course times.
	
	var DAY_HOUR_START = 7;   // start at 7AM
	var DAY_HOUR_END = 23;    // end at 11PM
	var COURSE_COLORS = [
		"#f33",
		"#3f3",
		"#33f",
		"#f3f",
		"#ff3",
		"#34c",
		"#c43",
		"#c34"
	]
	// we also want to extract the building and location.
	for (var i = 0; i < found_data.length; i++) {
		var new_found_data = {};
		// get rid of all of the commas
		var TStrNoComma = found_data[i].time_place_str.replace(/,/g, "");
		var splitTStr = TStrNoComma.split(" ");
		// start with the third element, where the days begin
		new_found_data.days_on = [];
		var days = 0;
		// loop while 'next_day' is does not start with a letter 
		// that any day of the weeks begin iwth.
		while (splitTStr[2 + days].match(/^(M|T|W|F|S)/i) !== null) { 
			new_found_data.days_on.push(splitTStr[2 + days])
			days++;
		}
		
		var startTimeStr = splitTStr[2 + days];
		new_found_data.startTimeStr = startTimeStr;
		new_found_data.startHour = parseInt(startTimeStr.split(/:/)[0]);
		new_found_data.startMinute = parseInt(startTimeStr.split(/:/)[1].substr(0, 2));
		new_found_data.startHourMod = startTimeStr.substr(startTimeStr.length - 2);
		
		var endTimeStr = splitTStr[4 + days];
		new_found_data.endTimeStr = endTimeStr;
		new_found_data.endHour = parseInt(endTimeStr.split(/:/)[0]);
		new_found_data.endMinute = parseInt(endTimeStr.split(/:/)[1].substr(0, 2));
		new_found_data.endHourMod = endTimeStr.substr(startTimeStr.length - 2);
		
		// process the location, which is going to be all the strings after.
		// the time is finished that does not start with "room"
		new_found_data.realMinuteStart = 
			new_found_data.startMinute + 
			(60 * (new_found_data.startHour - DAY_HOUR_START +
				(new_found_data.startHourMod.startsWith("P") && new_found_data.startHour != 12 ? 12 : 0)));
		new_found_data.realMinuteEnd =  
			new_found_data.endMinute + 
			(60 * (new_found_data.endHour - DAY_HOUR_START +
				(new_found_data.endHourMod.startsWith("P") && new_found_data.endHour != 12 ? 12 : 0)));
		
		new_found_data.building = "";
		var loc_strs = 0;
		while(splitTStr[5 + days + loc_strs].match(/room/i) == null) {
			new_found_data.building += splitTStr[5 + days + loc_strs ] + " ";
			loc_strs++;
		}
		new_found_data.building = new_found_data.building.trim();
		// finally, get the room number
		new_found_data.room_number = parseInt(splitTStr[6 + days + loc_strs]);
		
		// style options
		new_found_data.block_color = COURSE_COLORS[i];
		
		// transfer the old values
		new_found_data.name_str = found_data[i].name_str;
		
		//new_found_data.time_place_str = found_data[i].time_place_str;
		found_data[i] = new_found_data;
	}
	/*
	// name_str is the name of the course
	var writeString = "<table>";
	writeString += "<tr><td>name_str</td>"
				//+ "<td>time_place_str</td>"
				+ "<td>days_on</td>"
				+ "<td>startTime</td>"
				+ "<td>endTime</td>"
				+ "<td>building</td>"
				+ "<td>roomNumber</td>"
				+ "</tr>";
	for (var i = 0 ; i < found_data.length; i++) {
		writeString += "<tr>";
		writeString += "<td>" + (found_data[i].name_str) +"</td>"
		//writeString += "<td>" + (found_data[i].time_place_str) + "</td>";
		writeString += "<td>" + (found_data[i].days_on) + "</td>";
		writeString += "<td>" + (found_data[i].startHour + ":" + found_data[i].startMinute + found_data[i].startHourMod) + "</td>"; // start time
		writeString += "<td>" + (found_data[i].endHour + ":" + found_data[i].endMinute + found_data[i].endHourMod) + "</td>"; // end time
		writeString += "<td>" + (found_data[i].building) + "</td>"; // building
		writeString += "<td>" + (found_data[i].room_number) + "</td>"; // room
		writeString += "</tr>";
	}
	writeString += "</table>";
	document.getElementById("output").innerHTML = writeString;
	*/
	
	
	// found_data has all information about the schedule
	var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
	var display_data = [];
	for (var i=0; i < days.length; i++) {
		display_data[i] = {
			day : days[i],
			courses : []
		}
		for (var j = 0; j < found_data.length; j++) {
			// search the days this course is happening
			// to see if is happening on the current day.
			for (var a = 0; a < found_data[j].days_on.length; a++) {
				if (found_data[j].days_on[a].startsWith(days[i])) {
					display_data[i].courses.push(found_data[j]);
				}
			}
		}
	}
	
	//console.log(display_data);
	
	// now that we have all the data we need, we can make our super nice
	// and well formated schedule (I hope...);
	
	// FEATURES OF THE CHART
	// - each column represents one day of the week...
	// the time of the day starts at 7am at the very top and then goes down until
	// 11pm...
	
	// - each time slot will be one block of time for a course.
	// - every course will have its own color
	// - On each block will be the shortname of the course, the time, 
	//     and where it is located
	// - there will be lines in the background every half hour to make 
	//    the chart a little easier to read.
	var width = 1280 // 800,    // dimensions of whole canvas
		height = 720; // 600;
	var graphW = width - 120,   // dimensions of the graph portion
		graphH = height - 60,
		graphX = 100,
		graphY = 40;
	var totalMinutes = (DAY_HOUR_END - DAY_HOUR_START) * 60;
	var minuteHeight = graphH / totalMinutes;
	var barWidth =  graphW / days.length	; // one column foe each day of the week.
	
	// using Snap.svg
	var snap = Snap("#output_drawing");	
	snap.attr({ width : width, height : height});

	for (var half_hour = 0; half_hour < totalMinutes/30; half_hour += 1) {
		var yPos = graphY + (half_hour * minuteHeight * 30);
		snap.rect(graphX, yPos, graphW, 1)
			.attr({ fill : "#cfcfcf" });
		
		if (half_hour % 2 == 0) {
			var totalHour = (7 + Math.floor(half_hour / 2));
			var hourMod = "am";
			if (totalHour == 12) {
				hourMod = "pm"
			} else if (totalHour > 12) {
				totalHour -= 12;
				hourMod = "pm"
			}
			snap.text(graphX-70,yPos+3, totalHour + ":00" + hourMod);
		}
	}
	for (var c = 0; c < display_data.length; c++) {      // c for what column you're on
		var xPos = c * barWidth
		if (c !== 0) {
			snap.rect(graphX + xPos, graphY, 2, graphH)
				.attr({ fill : "#cccccc" });
		}
		snap.text(graphX + xPos + (barWidth/2) - 25, graphY - 5, display_data[c].day);

		for (var k = 0; k < display_data[c].courses.length; k++) {   // k for what course you're on.
			var curr_course = display_data[c].courses[k];
			var courseYPos = minuteHeight * (curr_course.realMinuteStart);
			var courseHeight = minuteHeight * ((curr_course.realMinuteEnd
						- curr_course.realMinuteStart));
				
			snap.rect(graphX + xPos, graphY + courseYPos, barWidth, courseHeight)
				.attr({ fill : curr_course.block_color, 
						alt : curr_course.name_str });
			// display the course name
			snap.text(graphX + xPos + 5, graphY + courseYPos + 15, display_data[c].courses[k].name_str.split(" ")[0]);
			// diplay the course times
			snap.text(graphX + xPos + 5, graphY + courseYPos + 35, 
				curr_course.startTimeStr + "-" + curr_course.endTimeStr);
		}
	}
	// border around the graph itself
	snap.rect(graphX, graphY, graphW, graphH)
		.attr({ stroke: "#000000", fill : "none" });
}