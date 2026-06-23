const display = document.getElementById("display");
const historyList = document.getElementById("historyList");

function appendValue(value){
    display.value += value;
}

function clearDisplay(){
    display.value = "";
}

function deleteLast(){
    display.value = display.value.slice(0, -1);
}

function calculate(){

    try{

        const expression = display.value;
        const result = eval(expression);

        const li = document.createElement("li");
        li.textContent = `${expression} = ${result}`;

        historyList.prepend(li);

        display.value = result;

    }catch{

        display.value = "Error";

        setTimeout(() => {
            display.value = "";
        }, 1000);
    }
}

/* Keyboard Support */

document.addEventListener("keydown", (e) => {

    if(!isNaN(e.key)){
        appendValue(e.key);
    }

    if(["+","-","*","/","."].includes(e.key)){
        appendValue(e.key);
    }

    if(e.key === "Enter"){
        calculate();
    }

    if(e.key === "Backspace"){
        deleteLast();
    }

    if(e.key === "Escape"){
        clearDisplay();
    }
});

/* Live Clock */

function updateClock(){

    const now = new Date();

    document.getElementById("clock").innerHTML =
    now.toLocaleTimeString([],{
        hour:'2-digit',
        minute:'2-digit'
    });
}

setInterval(updateClock,1000);
updateClock();