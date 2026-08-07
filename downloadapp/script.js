function downloadFile(fileName){


    const message =
    document.getElementById("message");


    message.innerHTML="";


    fetch(fileName, {
        method:"HEAD"
    })


    .then(response=>{


        if(response.ok){


            let link =
            document.createElement("a");


            link.href=fileName;

            link.download=fileName;


            document.body.appendChild(link);


            link.click();


            link.remove();


        }

        else{


            message.innerHTML =
            fileName + " is absent.";

        }


    })


    .catch(()=>{


        message.innerHTML =
        fileName + " is absent.";


    });


}function goBack(){
    window.location.href = "../index.html";
}

