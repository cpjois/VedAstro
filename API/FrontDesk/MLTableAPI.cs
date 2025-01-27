﻿using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using VedAstro.Library;
using Newtonsoft.Json.Linq;

namespace API
{
    public class MLTableAPI
    {


        private const string Route1 = $"{nameof(GenerateMLTable)}/{{SelectedFormat}}"; //* that captures the rest of the URL path

        /// <summary>
        /// Generates Time List from an excel file uploaded by user to be parsed and returned as Time list
        /// </summary>
        [Function(nameof(GetMLTimeListFromExcel))]
        public static async Task<HttpResponseData> GetMLTimeListFromExcel(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = nameof(GetMLTimeListFromExcel))]
            HttpRequestData incomingRequest)
        {
            try
            {
                //0 : LOG CALL
                await APILogger.Visit(incomingRequest);

                //1 : GET DATA OUT 
                var excelBinary = incomingRequest.Body;
                excelBinary.Position = 0;
                var foundRawTimeList = await Tools.ExtractTimeColumnFromExcel(excelBinary);
                var foundGeoLocationList = await Tools.ExtractLocationColumnFromExcel(excelBinary);

                //3 : COMBINE DATA
                var returnList = foundRawTimeList.Select(dateTimeOffset => new Time(dateTimeOffset, foundGeoLocationList[foundRawTimeList.IndexOf(dateTimeOffset)])).ToList();

                //convert raw XML to Person Json
                var personListJson = Tools.ListToJson(returnList);

                return APITools.PassMessageJson(personListJson, incomingRequest);

            }

            //if any failure, show error in payload
            catch (Exception e)
            {
                APILogger.Error(e, incomingRequest);
                return APITools.FailMessageJson(e.Message, incomingRequest);
            }

        }

        /// <summary>
        /// Generates an instance of ML Table and is sent back wrapped in JSON form
        /// </summary>
        [Function(nameof(GenerateMLTable))]
        public static async Task<HttpResponseData> GenerateMLTable(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = Route1)]
            HttpRequestData incomingRequest, string SelectedFormat)
        {
            try
            {

                //0 : LOG CALL
                await APILogger.Visit(incomingRequest);

                //1 : PREPARE PARAMS DATA
                // Get body as stream
                incomingRequest.Body.Position = 0;// Reset the position
                using var reader = new StreamReader(incomingRequest.Body);
                var jsonText = await reader.ReadToEndAsync();
                // Parse JSON text
                var rootJson = JObject.Parse(jsonText);
                //return parsedJson;
                //var rootJson = await APITools.ExtractDataFromRequestJson(incomingRequest);

                //2 : GENERATE TABLE (HEAVY COMPUTE 🚀) 
                //extract out the time list
                var timeListJson = rootJson["TimeList"];
                var timeList = Time.FromJsonList(timeListJson);

                //extract out the column data
                var columnDataJson = rootJson["ColumnData"];
                Console.WriteLine(columnDataJson);
                var openApiMetadata = OpenAPIMetadata.FromJsonList(columnDataJson);

                var newMLTable = MLTable.FromData(timeList, openApiMetadata);


                //3 : SEND TO CALLER (HTML)

                switch (SelectedFormat)
                {
                    case "HTML":
                        {
                            var jsonMLTable = new JObject();
                            jsonMLTable["HTML"] = newMLTable.ToHtml();
                            return APITools.PassMessageJson(jsonMLTable, incomingRequest);
                        }
                    case "CSV":
                        {
                            var jsonMLTable = new JObject();
                            jsonMLTable["CSV"] = newMLTable.ToCSV();
                            return APITools.PassMessageJson(jsonMLTable, incomingRequest);
                        }
                    case "JSON":
                        {
                            var jsonMLTable = new JObject();
                            jsonMLTable["JSON"] = newMLTable.ToJson();
                            return APITools.PassMessageJson(jsonMLTable, incomingRequest);
                        }
                    case "EXCEL":
                        {
                            var excelFile = newMLTable.ToExcel();
                            return APITools.SendFileToCaller(excelFile, incomingRequest, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.");
                        }

                    default: throw new Exception("END OF LINE!");

                }

            }
            //if any failure, show error in payload
            catch (Exception e)
            {
                APILogger.Error(e, incomingRequest);
                return APITools.FailMessageJson(e.Message, incomingRequest);
            }
        }



        //----------------------------------PRIVATE FUNCS-----------------------------


    }
}
