
//Single place for all code related to animating Events Chart SVG
//used by light & full viewer

class EventsChart {
    //template used to generate legend rows
    static holderTemplateId = `#CursorLineLegendTemplate`;

    //get screen width
    static getScreenWidth() {
        return Math.max(
            document.body.scrollWidth,
            document.documentElement.scrollWidth,
            document.body.offsetWidth,
            document.documentElement.offsetWidth,
            document.documentElement.clientWidth
        );
    }

    //gets clients timezone offset, exp:"+08:00"
    static getParseableTimezone() {
        var date = new Date();
        var tzo = -date.getTimezoneOffset(),
            dif = tzo >= 0 ? '+' : '-',
            pad = function (num) {
                return (num < 10 ? '0' : '') + num;
            };

        return dif +
            pad(Math.floor(Math.abs(tzo) / 60)) +
            ':' +
            pad(Math.abs(tzo) % 60);
    }

    static getDataFromToolbar() {

        //get needed data out of selection boxes
        var chartData = {
            "timePreset": $("#TimePresetSelector").val(),
            "eventPreset": $("#EventPresetSelector").val(),
            "personId": window.PersonId,
            "maxWidth": EventsChart.getScreenWidth(),
            "timezone": EventsChart.getParseableTimezone(),
            "url": ""//empty string first
        };

        //reset parts of the URL with data from selection boxes
        var pathname = window.location.pathname.split("/");
        pathname[pathname.length - 1] = chartData.timePreset;
        pathname[pathname.length - 2] = chartData.eventPreset;
        pathname[pathname.length - 3] = chartData.personId;

        //construct the final URL back
        var newUrl = pathname.join('/');
        chartData.url = newUrl;
        return chartData;
    }

    static getDataFromUrl() {

        //get data out of url
        var pathname = window.location.pathname.split("/");
        //url pattern chart/{personId}/{eventPreset}/{timePreset}
        var returnVal = {
            "timePreset": pathname[pathname.length - 1],
            "eventPreset": pathname[pathname.length - 2],
            "personId": pathname[pathname.length - 3],
            "maxWidth": EventsChart.getScreenWidth(),
            "timezone": EventsChart.getParseableTimezone()
        };

        return returnVal;
    }

    //fired when mouse moves over dasa view box
    //used to auto update cursor line & time legend
    static async onMouseMoveHandler(mouse) {
        //console.log(`JS: onMouseMoveDasaViewEventHandler`);

        //get relative position of mouse in Dasa view
        var mousePosition = getMousePositionInElement(mouse, "#EventChartHolder");

        //if mouse is out of dasa view hide cursor and end here
        if (mousePosition == 0) { $("#CursorLine").hide(); return; }
        else { $("#CursorLine").show(); }

        //move cursor line 1st for responsiveness
        autoMoveCursorLine(mousePosition.xAxis);

        //update time legend
        generateTimeLegend(mousePosition);

        //FUNCTIONS
        //Gets a mouses x axis relative inside the given element
        //used to get mouse location on Dasa view
        //returns 0 when mouse is out
        function getMousePositionInElement(mouseEventData, elementId) {
            //console.log(`JS: GetMousePositionInElement`);

            //gets the measurements of the dasa view holder
            //the element where cursor line will be moving
            //TODO read val from global var
            let holderMeasurements = $(elementId)[0].getBoundingClientRect();

            //calculate mouse X relative to dasa view box
            let relativeMouseX = mouseEventData.clientX - holderMeasurements.left;
            let relativeMouseY = mouseEventData.clientY - holderMeasurements.top; //when mouse leaves top
            let relativeMouseYb = mouseEventData.clientY - holderMeasurements.bottom; //when mouse leaves bottom

            //if mouse out of element element, set 0 as indicator
            let mouseOut = relativeMouseY < 0 || relativeMouseX < 0 || relativeMouseYb > 0;

            if (mouseOut) {
                return 0;
            } else {

                var mouse = {
                    xAxis: relativeMouseX,
                    yAxis: relativeMouseY
                };
                return mouse;
            }

        }

        function autoMoveCursorLine(relativeMouseX) {
            //console.log(`JS: autoMoveCursorLine`);

            //move vertical line to under mouse inside dasa view box
            $("#CursorLine").attr('transform', `matrix(1, 0, 0, 1, ${relativeMouseX}, 0)`);

        }

        //SVG Event Chart Time Legend generator
        //this is where the whole time legend that follows
        //the mouse when placed on chart is generated
        //notes: a template row always exists in code,
        //in client JS side uses template to create the rows from cloning it
        //and modifying its prop as needed, as such any major edit needs to
        //be done in API code
        function generateTimeLegend(mousePosition) {
            //console.log(`JS: autoUpdateTimeLegend`);

            //x axis is rounded because axis value in rect is whole numbers
            //and it has to be exact match to get it
            var mouseRoundedX = Math.round(mousePosition.xAxis);
            var mouseRoundedY = Math.round(mousePosition.yAxis);

            //use the mouse position to get all dasa rect
            //dasa elements at same X position inside the dasa svg
            //note: faster and less erroneous than using mouse.path
            var children = $("#EventChartHolder").children();
            var allElementsAtX = children.find(`[x=${mouseRoundedX}]`);


            //delete previously generated legend rows
            $(".CursorLineLegendClone").remove();


            //count good and bad events for summary row
            var goodCount = 0;
            var badCount = 0;
            var newRowYAxis = 0; //vertical position of the current event row
            window.showDescription = false;//default description not shown
            //extract event data out and place it in legend
            allElementsAtX.each(drawEventRow);

            //auto show/hide description box based on mouse position
            if (window.showDescription) {
                $("#CursorLineLegendDescriptionHolder").show();
            } else {
                $("#CursorLineLegendDescriptionHolder").hide();
            }



            //5 GENERATE LAST SUMMARY ROW
            //generate summary row at the bottom
            //make a copy of template for this event
            var newSummaryRow = $(EventsChart.holderTemplateId).clone();
            newSummaryRow.removeAttr('id'); //remove the clone template id
            newSummaryRow.addClass("CursorLineLegendClone"); //to delete it on next run
            newSummaryRow.appendTo("#CursorLineLegendHolder"); //place new legend into parent
            newSummaryRow.show();//make cloned visible
            //position the group holding the legend over the event row which the legend represents
            newSummaryRow.attr('transform', `matrix(1, 0, 0, 1, 10, ${newRowYAxis + 15 - 1})`);//minus 1 for perfect alignment

            //set event name text & color element
            var textElm = newSummaryRow.children("text");
            textElm.text(` Good : ${goodCount}   Bad : ${badCount}`);
            //change icon to summary icon
            newSummaryRow.children("use").attr("xlink:href", "#CursorLineSumIcon");

            //FUNCTIONS

            //
            function drawEventRow() {

                //this is the rect generated by API containing data about the event
                var svgEventRect = this;

                //1 GET DATA
                //extract other data out of the rect
                var eventName = svgEventRect.getAttribute("eventname");
                //if no "eventname" exist, wrong elm skip it
                if (!eventName) { return; }

                var color = svgEventRect.getAttribute("fill");
                newRowYAxis = parseInt(svgEventRect.getAttribute("y"));//parse as num, for calculation

                //count good and bad events for summary row
                var eventNatureName = "";// used later for icon color
                if (color === "#FF0000") { eventNatureName = "Bad", badCount++; }
                if (color === "#00FF00") { eventNatureName = "Good", goodCount++; }


                //2 TIME & AGE LEGEND
                //create time legend at top only for first element
                if (allElementsAtX[0] === svgEventRect) { drawTimeAgeLegendRow(); }

                //3 GENERATE EVENT ROW
                //make a copy of template for this event
                var newLegendRow = $(EventsChart.holderTemplateId).clone();
                newLegendRow.removeAttr('id'); //remove the clone template id
                newLegendRow.addClass("CursorLineLegendClone"); //to delete it on next run
                newLegendRow.appendTo("#CursorLineLegendHolder"); //place new legend into special holder
                newLegendRow.show();//make cloned visible
                //position the group holding the legend over the event row which the legend represents
                newLegendRow.attr('transform', `matrix(1, 0, 0, 1, 10, ${newRowYAxis - 2})`);//minus 2 for perfect alignment

                //set event name text & color element
                var textElm = newLegendRow.children("text");
                var iconElm = newLegendRow.children("use");
                textElm.text(`${eventName}`);
                iconElm.attr("xlink:href", `#CursorLine${eventNatureName}Icon`); //set icon color based on nature

                //4 GENERATE DESCRIPTION ROW LOGIC
                //check if mouse in within row of this event (y axis)
                var elementTopY = newRowYAxis;
                var elementBottomY = newRowYAxis + 15;
                var mouseWithinRow = mouseRoundedY >= elementTopY && mouseRoundedY <= elementBottomY;
                //if event name is still the same then don't load description again
                var notSameEvent = window.previousHoverEventName !== eventName;

                //HIGHLIGHT ROW
                //if mouse is in event's row then highlight that row
                if (mouseWithinRow) {
                    //highlight event name row
                    var backgroundElm = newLegendRow.children("rect");
                    backgroundElm.css("fill", "#003e99");
                    backgroundElm.css("opacity", "1");//solid
                    //textElm.css("fill", "#fff");
                    textElm.css("font-weight", "700");
                    //if mouse within show description box
                    window.showDescription = true;
                }

                //if mouse within row AND the event has changed
                //then generate a new description
                //note: this is slow, so done only when absolutely needed
                if (mouseWithinRow && notSameEvent) {

                    //make holder visible
                    $("#CursorLineLegendDescriptionHolder").show();

                    //move holder next to event
                    var descBoxYAxis = newRowYAxis - 9;//minus 5 for perfect alignment with event name row
                    $("#CursorLineLegendDescriptionHolder").attr("transform", `matrix(1, 0, 0, 1, 0, ${descBoxYAxis})`);

                    //note: using trigger to make it easy to skip multiple clogging events
                    $(document).trigger('loadEventDescription', eventName);

                    //update previous hover event
                    window.previousHoverEventName = eventName;
                }


                function drawTimeAgeLegendRow() {
                    var newTimeLegend = $(EventsChart.holderTemplateId).clone();
                    newTimeLegend.removeAttr('id'); //remove the clone template id
                    newTimeLegend.addClass("CursorLineLegendClone"); //to delete it on next run
                    newTimeLegend.appendTo("#CursorLineLegendHolder"); //place new legend into special holder
                    newTimeLegend.show();//make cloned visible
                    newTimeLegend.attr('transform', `matrix(1, 0, 0, 1, 10, ${newRowYAxis - 15})`); //above 1st row
                    //split time to remove timezone from event
                    var stdTimeFull = svgEventRect.getAttribute("stdtime");
                    var stdTimeSplit = stdTimeFull.split(" ");
                    var hourMin = stdTimeSplit[0];
                    var date = stdTimeSplit[1];
                    var timezone = stdTimeSplit[2];
                    var age = svgEventRect.getAttribute("age");
                    newTimeLegend.children("text").text(`${hourMin} ${date}  AGE: ${age}`);
                    //replace circle with clock icon
                    newTimeLegend.children("use").attr("xlink:href", "#CursorLineClockIcon");
                }

            }


        }

    }

    //on mouse leave event chart, auto hide time legend
    static async onMouseLeaveEventChart(mouse) {
        $("#CursorLine").hide();
    }

    //gets chart from API & injects it into page
    static async getEventsChartFromApi(chartData) {
        console.log(`Getting events chart from API...`);

        var payload = `<Root><PersonId>${chartData.personId}</PersonId><TimePreset>${chartData.timePreset}</TimePreset><EventPreset>${chartData.eventPreset}</EventPreset><Timezone>${chartData.timezone}</Timezone><MaxWidth>${chartData.maxWidth}</MaxWidth></Root>`;

        var response = await fetch("https://vedastroapi.azurewebsites.net/api/geteventscharteasy", {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
                "content-type": "plain/text; charset=utf-8",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "cross-site"
            },
            "referrer": "https://www.vedastro.org/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": payload,
            "method": "POST",
            "mode": "cors",
            "credentials": "omit"
        });

        //inject new svg chart into page
        var svgChartString = await response.text();
        injectIntoElement($("#DasaViewBox")[0], svgChartString);


        //LOCAL FUNCTIONS
        function injectIntoElement(element, valueToInject) {
            console.log(`Injecting SVG Chart into page...`);

            //convert string to html node
            var template = document.createElement("template");
            template.innerHTML = valueToInject;
            var svgElement = template.content.firstElementChild;

            //save for later use
            EventsChart.Element = svgElement;

            //place new node in parent
            element.innerHTML = ''; //clear current children if any
            element.appendChild(EventsChart.Element);
        }

    }

    static loadEventDescription(event, eventName) {

        //off events while firing
        $(document).off('loadEventDescription');

        //fill description box about event
        getEventDescription(eventName.replace(/ /g, "")).then(drawDescriptionBox);

        //turn events back on
        $(document).on('loadEventDescription', EventsChart.loadEventDescription);


        //FUNCTIONS
        function drawDescriptionBox(eventDesc) {
            //if no description than hide box & end here
            if (!eventDesc) { window.showDescription = false; return; }
            //convert text to svg and place inside holder
            var wrappedDescText = textToSvg(eventDesc, 175, 24);

            $("#CursorLineLegendDescription").empty(); //clear previous desc
            $(wrappedDescText).appendTo("#CursorLineLegendDescription"); //add in new desc
            //set height of desc box background
            $("#CursorLineLegendDescriptionBackground").attr("height", window.EventDescriptionTextHeight + 20); //plus little for padding

            //FUNCTION
            //  This function attempts to create a new svg "text" element, chopping
            //  it up into "tspan" pieces, if the caption is too long
            function textToSvg(caption, x, y) {
                //console.log(`JS: createSVGtext`);

                //svg "text" element to hold smaller text lines
                var svgTextHolder = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                svgTextHolder.setAttributeNS(null, 'x', x);
                svgTextHolder.setAttributeNS(null, 'y', y);
                svgTextHolder.setAttributeNS(null, 'font-size', 10);
                svgTextHolder.setAttributeNS(null, 'fill', '#FFF');
                svgTextHolder.setAttributeNS(null, 'text-anchor', 'left');

                //The following two variables can be passed as parameters
                var maximumCharsPerLine = 30;
                var lineHeight = 10;

                var words = caption.split(" ");
                var line = "";

                //process text and create rows
                var svgTSpan;
                var lineCount = 0; //number of lines to calculate height
                var tSpanTextNode;
                for (var n = 0; n < words.length; n++) {
                    var testLine = line + words[n] + " ";
                    if (testLine.length > maximumCharsPerLine) {
                        //  Add a new <tspan> element
                        svgTSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                        svgTSpan.setAttributeNS(null, 'x', x);
                        svgTSpan.setAttributeNS(null, 'y', y);

                        tSpanTextNode = document.createTextNode(line);
                        svgTSpan.appendChild(tSpanTextNode);
                        svgTextHolder.appendChild(svgTSpan);

                        line = words[n] + " ";
                        y += lineHeight; //place next text row lower
                        lineCount++; //count a line
                    }
                    else {
                        line = testLine;
                    }
                }

                //calculate final height in px, save global to be accessed later
                window.EventDescriptionTextHeight = lineCount * lineHeight;
                //console.log(window.EventDescriptionTextHeight);

                svgTSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                svgTSpan.setAttributeNS(null, 'x', x);
                svgTSpan.setAttributeNS(null, 'y', y);

                tSpanTextNode = document.createTextNode(line);
                svgTSpan.appendChild(tSpanTextNode);

                svgTextHolder.appendChild(svgTSpan);

                return svgTextHolder;
            }

        }

        //gets events from EventDataList.xml
        //for viewing in time legend
        async function getEventDescription(eventName) {
            //console.log(`JS: getEventDescription`);

            //search for matching event name
            var eventXmlList = window.EventDataListXml.find('Event'); //get all event elements
            var results = eventXmlList.filter(
                function () {
                    var eventNameXml = $(this).children('Name').eq(0);
                    return eventNameXml.text() === eventName;
                });

            var eventDescription = results.eq(0).children('Description').eq(0).text();

            //remove tabs and new line to make easy detection of empty string
            let cleaned = eventDescription.replace(/ {4}|[\t\n\r]/gm, '');
            return cleaned;

        }

    }

    //needs to be run once before get event description method is used
    //loads xml file located in wwwroot to xml global data
    static async loadEventDataListFile() {

        //only load new file if none available
        if (!window.EventDataListXml) {
            //get data list from server and store it for later use
            //NOTE: CORS in Azure Website Storage needs to be disabled for this to work, outside of vedastro.org
            $(function () {
                $.ajax({
                    type: "get",
                    url: "https://www.vedastro.org/data/EventDataList.xml",
                    dataType: "xml",
                    success: function (data) {
                        //let user know
                        console.log(`Getting event data file from API...`);
                        //save for later
                        window.EventDataListXml = $(data); //jquery for use with .filter
                    },
                    error: function (xhr, status) {
                        /* handle error here */
                        console.log(status);
                    }
                });
            });
        } else {
            console.log(`Using cached event data file.`);
        }

    }

    //returns true if svg loaded
    static isSvgLoaded() {
        console.log(`Checking if SVG Chart is loaded...`);

        //check if svg already loaded into page
        var x = $("#DasaViewBox").children().first().is("svg");

        return x;
    }

    static hideLoading() {
        //hide default loading box
        $("#LoadingBox").hide();
        //show svg chart
        $("#DasaViewBox").show();
        //show toolbar
        $("#ToolBar").show();
    }

    static showLoading() {
        //show default loading box
        $("#LoadingBox").show();
        //hide svg chart
        $("#DasaViewBox").hide();
        //hide toolbar
        $("#ToolBar").hide();

    }

    static getScreenHeight() {
        return Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight,
            document.documentElement.clientHeight
        );
    }

    //attaches all needed handlers to animate a chart
    static async initializeChart(chartElement$) {
        console.log("Attaching events to chart...");

        //save for easier reference
        EventsChart.Element = chartElement$;

        //attach mouse handler to auto move cursor line & update time legend
        //load event description file 1st
        await EventsChart.loadEventDataListFile();

        EventsChart.Element[0].addEventListener("mousemove", EventsChart.onMouseMoveHandler);

        EventsChart.Element[0].addEventListener("mouseleave", EventsChart.onMouseLeaveEventChart);

        //attach handler to load event description file before hand
        $(document).on('loadEventDescription', EventsChart.loadEventDescription);

        //save now line
        EventsChart.NowVerticalLine = EventsChart.Element.find('#NowVerticalLine');

        //update once now
        updateNowLine();

        //setup to auto update every 1 minute
        setInterval(function () { updateNowLine(); }, 60 * 1000); // 60*1000ms

        //update now line position
        function updateNowLine() {
            console.log("Updating now line position...");

            //get all rects
            var allEventRects = EventsChart.Element.find(".EventListHolder").children("rect");

            //find closest rect to now time
            var closestRectToNow;
            allEventRects.each(function (index) {
                //get parsed time from rect
                var svgEventRect = this;
                var rectTime = getTimeInRect(svgEventRect).getTime();//(milliseconds since 1 Jan 1970)
                var nowTime = Date.now();

                //if not yet reach continue, keep reference to this and goto next
                if (rectTime <= nowTime) {
                    closestRectToNow = svgEventRect;
                    return true; //go next
                }
                //already passed now time, use previous rect as now, stop looking
                else { return false; }
            });

            //get horizontal position of now rect (x axis)
            var xAxisNowRect = closestRectToNow.getAttribute("x");
            EventsChart.NowVerticalLine.attr('transform', `matrix(1, 0, 0, 1, ${xAxisNowRect}, 0)`);

        }

        //parses the STD time found in rect and returns it
        function getTimeInRect(eventRect$) {
            //convert "00:28 17/11/2022 +08:00" to "2019-01-01T00:00:00.000+00:00"
            var stdTimeRaw = eventRect$.getAttribute("stdtime");
            var stdTimeSplit = stdTimeRaw.split(" ");
            var hourMin = stdTimeSplit[0];
            var dateFull = stdTimeSplit[1].split('/');
            var date = dateFull[0];
            var month = dateFull[1];
            var year = dateFull[2];
            var timezone = stdTimeSplit[2];
            var rectTime = new Date(`${year}-${month}-${date}T${hourMin}:00.000${timezone}`);

            return rectTime;
        }
    }

    //coming from direct/url access page
    //the method called to start the JS code to animate an already loaded chart
    static async animateEventsChart() {
        console.log(`Starting the engine...`);

        //set title for easy multi-tabbing (not chart related)
        document.title = `${window?.ChartType} | ${window?.PersonName}`;

        //set toolbar data (not chart related)
        $("#PersonNameBox").text("Person : " + window?.PersonName);

        var notLoaded = !EventsChart.isSvgLoaded();

        //try get svg from server if svg not loaded by now
        //coming from live chart generate
        if (notLoaded) {
            //get data to generate chart from URL
            var data = EventsChart.getDataFromUrl();

            await EventsChart.getEventsChartFromApi(data);
        }

        //attach mouse handler to auto move cursor line & update time legend
        //load event description file 1st
        var svgChart$ = $("#DasaViewBox").children().first();
        await EventsChart.initializeChart(svgChart$);

        //make toolbar visible
        $("#ToolBar").removeClass("visually-hidden");

        EventsChart.hideLoading();

    }
}

//special function for blazor side
function EventsChartInit() { EventsChart.animateEventsChart(); }