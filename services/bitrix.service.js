const axios = require("axios");
require("dotenv").config();

const WEBHOOK = process.env.BITRIX_WEBHOOK?.trim().replace(/\/$/, "");



if (!WEBHOOK) {
  throw new Error("BITRIX_WEBHOOK missing in .env");
}


const api = axios.create({
  baseURL: WEBHOOK,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});



// Request Logger
api.interceptors.request.use((config) => {

  console.log("\n========== BITRIX REQUEST ==========");
  console.log(
    config.method.toUpperCase(),
    config.baseURL + config.url
  );

  console.dir(config.data, { depth: null });

  console.log("====================================");

  return config;
});



// Response Logger
api.interceptors.response.use(

  response => {

    console.log("\n========== BITRIX RESPONSE ==========");

    console.dir(
      response.data,
      { depth: null }
    );

    console.log("====================================\n");

    return response;
  },


  error => {

    console.log("\n========== BITRIX ERROR ==========");

    console.log(
      "URL:",
      error.config?.baseURL + error.config?.url
    );


    console.log(
      "MESSAGE:",
      error.message
    );


    console.dir(
      error.response?.data,
      { depth: null }
    );


    console.log("===================================\n");


    return Promise.reject(error);
  }

);





async function createLead(data) {

  try {


    console.log("\n========== CREATE LEAD DATA ==========");

    console.dir(
      data,
      { depth: null }
    );

    console.log("======================================");



    if (!data) {
      throw new Error("Bitrix data missing");
    }



    const customerName =
      data.name ||
      data.fullName ||
      "Website Customer";



    if (!data.domain) {

      throw new Error(
        "Domain required"
      );

    }



    let contactId = null;



    /*
      SEARCH CONTACT
    */

    if (data.email) {


      const searchResponse =
        await api.post(
          "/crm.contact.list.json",
          {
            filter: {
              EMAIL: data.email
            },

            select:[
              "ID",
              "NAME",
              "EMAIL"
            ]
          }
        );



      if (
        searchResponse.data.result &&
        searchResponse.data.result.length > 0
      ) {


        contactId =
          searchResponse.data.result[0].ID;


        console.log(
          "Existing Contact:",
          contactId
        );

      }


    }



    /*
      CREATE CONTACT
    */

    if (!contactId) {


      const contactPayload = {

        fields: {


          NAME: customerName,


          PHONE: data.phone
            ? [
                {
                  VALUE:data.phone,
                  VALUE_TYPE:"WORK"
                }
              ]
            : [],



          EMAIL: data.email
            ? [
                {
                  VALUE:data.email,
                  VALUE_TYPE:"WORK"
                }
              ]
            : [],



          COMMENTS:
`
Website Registration

Domain: ${data.domain}

Plan: ${data.plan || ""}

Billing: ${data.billingCycle || ""}
`

        }

      };



      const contactResponse =
        await api.post(
          "/crm.contact.add.json",
          contactPayload
        );



      if (!contactResponse.data.result) {

        throw new Error(
          JSON.stringify(contactResponse.data)
        );

      }



      contactId =
        contactResponse.data.result;



      console.log(
        "NEW CONTACT ID:",
        contactId
      );


    }




    /*
      CREATE DEAL
    */


    const dealPayload = {

      fields:{


        TITLE:
        `Hosting - ${data.domain}`,



        CONTACT_ID:
        contactId,



        OPPORTUNITY:
        Number(data.amount || 0),



        CURRENCY_ID:
        "INR",



        COMMENTS:
`
Customer: ${customerName}

Email: ${data.email || ""}

Phone: ${data.phone || ""}

Domain: ${data.domain}

Plan: ${data.plan || ""}

Billing: ${data.billingCycle || ""}
`

      }

    };



    const dealResponse =
      await api.post(
        "/crm.deal.add.json",
        dealPayload
      );



    if (!dealResponse.data.result) {

      throw new Error(
        JSON.stringify(dealResponse.data)
      );

    }



    console.log(
      "DEAL ID:",
      dealResponse.data.result
    );



    return {

      success:true,

      contactId,

      dealId:
      dealResponse.data.result

    };


  }

  catch(error) {


    console.log(
      "\n========== BITRIX FINAL ERROR =========="
    );


    console.log(
      error.message
    );


    console.log(
      "========================================\n"
    );


    throw error;

  }

}



module.exports = {
  createLead
};