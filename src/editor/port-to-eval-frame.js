/* global IODIDE_EVAL_FRAME_ORIGIN  */

import Mousetrap from "mousetrap";
import { evalConsoleInput } from "./actions/eval-actions";
import { addFile, deleteFile } from "./actions/actions";
import { genericFetch as fetchFileFromServer } from "../shared/utils/fetch-tools";
import { saveFileToServer, deleteFileOnServer } from "../shared/upload-file";
import validateActionFromEvalFrame from "./actions/eval-frame-action-validator";
import messagePasserEditor from "../shared/utils/redux-to-port-message-passer";

let portToEvalFrame;

export function postMessageToEvalFrame(messageType, message) {
  portToEvalFrame.postMessage({ messageType, message });
}

export function postActionToEvalFrame(actionObj) {
  postMessageToEvalFrame("REDUX_ACTION", actionObj);
}

const approvedKeys = [
  "esc",
  "ctrl+s",
  "ctrl+shift+e",
  "ctrl+d",
  "ctrl+h",
  "ctrl+i",
  "ctrl+shift+left",
  "ctrl+shift+right"
];

function validateRequestType(requestType) {
  if (!["LOAD_FILE", "SAVE_FILE", "DELETE_FILE"].includes(requestType)) {
    throw Error(`file operation "${requestType}" not defined`);
  }
}

function handleFileRequest(message) {
  const { path, fileRequestID, requestType } = message;
  let fileOperation;
  validateRequestType(requestType);
  if (requestType === "LOAD_FILE") {
    console.log("LOAD_FILE", message.path);
    fileOperation = fetchFileFromServer(
      `files/${path}`,
      message.metadata.fetchType
    );
  }
  if (requestType === "SAVE_FILE") {
    console.log("SAVE_FILE", message.path);
    const { notebookID, data, updateFile, fileID } = message.metadata;
    fileOperation = saveFileToServer(
      notebookID,
      data,
      path,
      updateFile,
      fileID
    ).then(fileInfo => {
      const { filename, lastUpdated, id } = fileInfo;
      messagePasserEditor.dispatch(addFile(filename, lastUpdated, id));
    });
  } else if (requestType === "DELETE_FILE") {
    console.log("DELETE_FILE", message.path);
    fileOperation = deleteFileOnServer(message.metadata.fileID).then(() => {
      messagePasserEditor.dispatch(deleteFile(message.metadata.fileID));
    });
  }
  fileOperation
    .then(file => {
      postMessageToEvalFrame("REQUESTED_FILE_OPERATION_SUCCESS", {
        file,
        fileRequestID,
        path: message.path
      });
    })
    .catch(err => {
      postMessageToEvalFrame("REQUESTED_FILE_OPERATION_ERROR", {
        path: message.path,
        fileRequestID,
        reason: err.message
      });
    });
}

function receiveMessage(event) {
  const trustedMessage = true;
  if (trustedMessage) {
    const { messageType, message } = event.data;
    switch (messageType) {
      case "CONSOLE_NEEDS_EVALUATION": {
        messagePasserEditor.dispatch(evalConsoleInput(message));
        break;
      }
      case "EVAL_FRAME_TASK_RESPONSE": {
        messagePasserEditor.dispatch(
          Object.assign(
            { type: `EVAL_FRAME_TASK_RESPONSE-${message.evalId}` },
            message
          )
        );
        break;
      }
      case "FILE_REQUEST": {
        handleFileRequest(message);
        break;
      }
      case "AUTOCOMPLETION_SUGGESTIONS": {
        const hintOptions = {
          disableKeywords: true,
          completeSingle: false,
          completeOnSingleClick: false
        };
        // CodeMirror is actually already in the global namespace.
        window.CodeMirror.showHint(
          window.ACTIVE_EDITOR_REF,
          () => message,
          hintOptions
        ); // eslint-disable-line
        window.ACTIVE_EDITOR_REF = undefined;
        break;
      }
      case "REDUX_ACTION":
        // in this case, `message` is a redux action
        if (validateActionFromEvalFrame(message)) {
          messagePasserEditor.dispatch(message);
        } else {
          console.error(
            `got unapproved redux action from eval frame: ${message.type}`
          );
        }
        break;
      case "KEYPRESS":
        // in this case, `message` is a keypress string
        if (approvedKeys.includes(message)) {
          Mousetrap.trigger(message);
        } else {
          console.error(
            `got unapproved key press action from eval frame: ${message}`
          );
        }
        break;
      default:
        console.error("unknown messageType", message);
    }
  }
}

export const listenForEvalFramePortReady = messageEvent => {
  if (messageEvent.data === "EVAL_FRAME_READY") {
    // IFRAME CONNECT STEP 2:
    // when editor gets "EVAL_FRAME_READY", it acks "EDITOR_READY"
    document
      .getElementById("eval-frame")
      .contentWindow.postMessage("EDITOR_READY", IODIDE_EVAL_FRAME_ORIGIN);
  }
  if (messageEvent.data === "EVAL_FRAME_SENDING_PORT") {
    // IFRAME CONNECT STEP 6:
    // editor gets port from eval frame, connection ready
    portToEvalFrame = messageEvent.ports[0]; // eslint-disable-line
    portToEvalFrame.onmessage = receiveMessage;
    messagePasserEditor.connectPostMessage(postMessageToEvalFrame);
    // stop listening for messages once a connection to the eval-frame is made
    window.removeEventListener("message", listenForEvalFramePortReady, false);
  }
};