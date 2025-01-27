﻿using VedAstro.Library;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using System.Net;

namespace API
{
	/// <summary>
	/// All API calls with no home are here, send them somewhere you think is good
	/// </summary>
	public class GeneralAPI
	{

		[Function("gethoroscope")]
		public static async Task<HttpResponseData> GetHoroscope([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = null)] HttpRequestData incomingRequest)
		{

			try
			{
				//get person from request
				var rootXml = await APITools.ExtractDataFromRequestXml(incomingRequest);
				var personId = rootXml.Value;

				var person = await VedAstro.Library.Tools.GetPersonById(personId);

				//calculate predictions for current person
				var predictionList = await VedAstro.Library.Tools.GetHoroscopePrediction(person.BirthTime, APITools.HoroscopeDataListFile);

				var sortedList = SortPredictionData(predictionList);

				//convert list to xml string in root elm
				return APITools.PassMessage(VedAstro.Library.Tools.AnyTypeToXmlList(sortedList), incomingRequest);

			}
			catch (Exception e)
			{
				//log error
				APILogger.Error(e, incomingRequest);
				//format error nicely to show user
				return APITools.FailMessage(e, incomingRequest);
			}



			List<HoroscopePrediction> SortPredictionData(List<HoroscopePrediction> horoscopePredictions)
			{
				//put rising sign at top
				horoscopePredictions.MoveToBeginning((horPre) => horPre.FormattedName.ToLower().Contains("rising"));

				//todo followed by planet in sign prediction ordered by planet strength 

				return horoscopePredictions;
			}

		}


		/// <summary>
		/// When browser visit API, they ask for FavIcon, so yeah redirect favicon from website
		/// </summary>
		[Function(nameof(FavIcon))]
		public static async Task<HttpResponseData> FavIcon([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "favicon.ico")] HttpRequestData incomingRequest)
		{
			//use same fav icon from website
			string url = "https://vedastro.org/images/favicon.ico";

			//send to caller
			using (var client = new HttpClient())
			{
				var bytes = await client.GetByteArrayAsync(url);
				var response = incomingRequest.CreateResponse(HttpStatusCode.OK);
				response.Headers.Add("Content-Type", "image/x-icon");
				await response.Body.WriteAsync(bytes, 0, bytes.Length);
				return response;
			}
		}

        
       

	}
}
