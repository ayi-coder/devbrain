- [Skip to main content](https://developer.mozilla.org/en-US/blog/exploring-the-broadcast-channel-api-for-cross-tab-communication/#content)
- [Skip to search](https://developer.mozilla.org/en-US/blog/exploring-the-broadcast-channel-api-for-cross-tab-communication/#search)

Learn frontend, backend, and AI from our course partner
[Scrimba](https://scrimba.com/learn/frontend?via=mdn)

[The Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API) enables communication between different browser windows, tabs, iframes, and web workers.
It provides a simple and efficient way to synchronize data and behavior across multiple [contexts](https://developer.mozilla.org/en-US/docs/Glossary/Browsing_context) of a browser for more reactive and engaging web applications.

In this article, we will explore Broadcast Channel API concepts, usage, and real-world applications.
We'll also walk through a practical example of building a small application that uses the API to send messages to different tabs and windows.

## [Understanding the Broadcast Channel API](https://developer.mozilla.org/en-US/blog/exploring-the-broadcast-channel-api-for-cross-tab-communication/\#understanding_the_broadcast_channel_api)

The Broadcast Channel API introduces a mechanism for different contexts by the same user and browser within the same origin to communicate with each other.
It operates on the principle of creating a single, shared channel that multiple browser contexts can join and leave at any time.

Once joined, these contexts can send and receive messages through the channel, enabling seamless data exchange and event propagation.
This mechanism eliminates the need for complex server-side communication.
Here's a quick look at how you use the API.

Creating or joining a channel:

jsCopy

```
const bc = new BroadcastChannel("test_channel");
```

Sending a message:

jsCopy

```
bc.postMessage("This is a test message");
```

Receiving a message (see [BroadcastChannel: message event](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel/message_event) for details):

jsCopy

```
bc.onmessage = (event) => {
  console.log(event.data);
  // { method: "add", note: "This is a test message" }
};
```

## [Building a Node.js application](https://developer.mozilla.org/en-US/blog/exploring-the-broadcast-channel-api-for-cross-tab-communication/\#building_a_node.js_application)

To begin, deploy a server by following the steps in [Deploying a server on Vultr](https://developer.mozilla.org/en-US/blog/deploying-node-js-applications-with-pm2-on-vultr/#deploying_a_server_on_vultr) section in our previous article.
Next, let's proceed to access the server terminal via SSH and set up a project for our web application.

We'll be using the [Nano](https://help.ubuntu.com/community/Nano) text editor to create and edit our project files on the server.
You can check the [shortcuts cheatsheet](https://www.nano-editor.org/dist/latest/cheatsheet.html) for help using Nano.
We'll also be using [Uncomplicated Firewall (UFW)](https://help.ubuntu.com/community/UFW) to control the traffic that is allowed in and out of the server.
In our application, we use [Node.js](https://docs.vultr.com/all?searchQuery=nodejs) to serve the index of our application and run the application using `http-server`.
Any other kind of server such as Python and Apache can also be used to achieve the same.
We also use the port `8080`to enable incoming traffic only through this port using UFW.

1. Create a project directory, and navigate into it.




bashCopy



```
mkdir notes-app
cd notes-app
```

2. Initialize a Node.js project.




bashCopy



```
npm init -y
```

3. Install an HTTP server dependency.




bashCopy



```
npm install http-server
```

4. Create an HTML file.




bashCopy



```
nano index.html
```

5. Copy and paste the code below into the `index.html` file.




htmlCopy



```
<!doctype html>
<html lang="en">
     <head>
       <meta charset="UTF-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
       <title>Note-taking App</title>
       <link rel="stylesheet" href="styles.css" />
     </head>
     <body>
       <h1>Note-taking App</h1>
       <div id="noteList"></div>
       <div id="noteForm">
         <label for="noteInput">New note</label>
         <input type="text" id="noteInput" placeholder="A note..." />
         <button id="addNoteButton">Add Note</button>
         <button id="resetNoteButton">Reset Notes</button>
       </div>
       <script src="app.js"></script>
     </body>
</html>
```

6. Save and exit the file.

7. Create a CSS file.




bashCopy



```
nano styles.css
```

8. Copy and paste the code below into the `styles.css` file.




cssCopy



```
body {
     font-family: Arial, sans-serif;
     background-color: #f4f4f4;
     margin: 0;
     padding: 20px;
}

h1 {
     color: #333;
     text-align: center;
}

#noteList {
     display: grid;
     row-gap: 10px;
     background-color: #fff;
     border: 1px solid #ddd;
     border-radius: 5px;
     padding: 10px;
     margin-bottom: 20px;
}

#noteList div {
     background-color: #f9f9f9;
     border: 1px solid #ddd;
     border-radius: 3px;
     padding: 10px;
}

#noteForm {
     display: grid;
     column-gap: 10px;
     align-items: center;
     grid-template-columns: max-content 1fr max-content max-content;
}

#noteInput {
     padding: 10px;
     border: 1px solid #ddd;
     border-radius: 3px;
     font-size: 16px;
}

button {
     padding: 10px 20px;
     background-color: #4caf50;
     color: #fff;
     border: none;
     border-radius: 3px;
     font-size: 16px;
     cursor: pointer;
}

button:hover {
     background-color: #45a049;
}
```

9. Save and exit the file.


## [Implementing the Broadcast Channel API](https://developer.mozilla.org/en-US/blog/exploring-the-broadcast-channel-api-for-cross-tab-communication/\#implementing_the_broadcast_channel_api)

1. In the `notes-app` directory, create a JavaScript file.




bashCopy



```
nano app.js
```

2. Copy and paste the JavaScript code below into `app.js`.




jsCopy



```
const noteList = document.getElementById("noteList");
const noteInput = document.getElementById("noteInput");
const addNoteButton = document.getElementById("addNoteButton");
const resetNoteButton = document.getElementById("resetNoteButton");

let notes = [];

function renderNotes() {
     noteList.innerHTML = "";

     notes.forEach((note) => {
       const noteItem = document.createElement("div");
       noteItem.textContent = note;
       noteList.appendChild(noteItem);
     });
}

addNoteButton.addEventListener("click", () => {
     const newNote = noteInput.value.trim();

     if (newNote) {
       notes.push(newNote);
       renderNotes();
       noteInput.value = "";

       channel.postMessage({ action: "add", note: newNote });
     }
});

resetNoteButton.addEventListener("click", () => {
     notes = [];
     renderNotes();

     channel.postMessage({ action: "reset" });
});

const channel = new BroadcastChannel("notes-channel");

channel.addEventListener("message", (event) => {
     const { action, note } = event.data;

     if (action === "add") {
       notes.push(note);
       renderNotes();
     } else if (action === "reset") {
       notes = [];
       renderNotes();
     }
});
```

3. Save and exit the file.

4. Allow incoming connections to port `8080`:




bashCopy



```
sudo ufw allow 8080
```

5. Start a file server.




bashCopy



```
npx http-server
```

6. Visit the application URL at `http://<server-ip>:8080`


Now you can open two browser windows or tabs side by side.
Add a note on one page in the application, and you will see that the note appears in the second tab without the need to refresh the page.
Try resetting all the notes, and you will see the notes get deleted from both the tabs without refreshing.

Let's look at the code we have written in `app.js`. The `renderNotes` function creates an element for each note added.
The `addNoteButton` function allows us to add notes in the application, and `channel.postMessage` broadcasts the "add" action to other windows or tabs.
Similarly, `resetNoteButton` allows us to delete all existing notes, and `channel.postMessage` broadcasts the "reset action" to other windows or tabs.

At the end, a new `BroadcastChannel` is created with the name 'notes-channel', allowing communication between different windows/tabs that share the same origin.
The event listener for `BroadcastChannel` listens for `message` events from the channel and takes action according to the input provided.

## [Real-world use cases and examples](https://developer.mozilla.org/en-US/blog/exploring-the-broadcast-channel-api-for-cross-tab-communication/\#real-world_use_cases_and_examples)

- In news and media websites
  - Use case: For synchronizing the reading progress of an article across multiple windows.
  - Example: A user can start reading an article and continue seamlessly from the same point on another window or tab, which allows for a consistent reading experience.
- In Productivity apps
  - Use case: For enabling real-time synchronization of changes in documents or files across multiple contexts.
  - Example: In a collaborative text editor, changes made by one user can be broadcast to other contexts in real-time.
- On social media platforms
  - Use case: For notifying users of new updates, messages, or notifications across multiple tabs or windows.
  - Example: If a user has multiple tabs open for a social media platform, they can receive real-time updates in all contexts, ensuring they never miss important information.

## [Conclusion](https://developer.mozilla.org/en-US/blog/exploring-the-broadcast-channel-api-for-cross-tab-communication/\#conclusion)

In this article, we explored the concepts, usage, and practical implementation of the Broadcast Channel API.
We built a basic synchronized note-taking application and learned how to use the Broadcast Channel API to build interconnected web experiences.

_This is a sponsored article by Vultr. Vultr is the world's largest privately-held cloud computing platform. A favorite with developers, Vultr has served over 1.5 million customers across 185 countries with flexible, scalable, global Cloud Compute, Cloud GPU, Bare Metal, and Cloud Storage solutions. Learn more about [Vultr](https://www.vultr.com/campaign/compute/)_