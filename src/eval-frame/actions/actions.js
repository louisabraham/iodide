import { NONCODE_EVAL_TYPES } from "../../state-schemas/state-schema";

import {
  evaluateLanguagePlugin,
  ensureLanguageAvailable,
  runCodeWithLanguage
} from "./language-actions";

import { evaluateFetchText } from "./fetch-cell-eval-actions";
import messagePasser from "../../redux-to-port-message-passer";

const CodeMirror = require("codemirror"); // eslint-disable-line

const initialVariables = new Set(Object.keys(window)); // gives all global variables
initialVariables.add("__core-js_shared__");
initialVariables.add("Mousetrap");
initialVariables.add("CodeMirror");
initialVariables.add("FETCH_RESOLVERS");

export function sendStatusResponseToEditor(status, evalId) {
  messagePasser.postMessage("EVALUATION_RESPONSE", { status, evalId });
}

export function addToEvaluationQueue(chunk) {
  messagePasser.postMessage("ADD_TO_EVALUATION_QUEUE", chunk);
}

function getUserDefinedVariablesFromWindow() {
  return Object.keys(window).filter(g => !initialVariables.has(g));
}

function IdFactory() {
  this.state = 0;
  this.nextId = () => {
    this.state += 1;
    return this.state;
  };
}

export const historyIdGen = new IdFactory();

class Singleton {
  constructor() {
    this.data = null;
  }
  set(data) {
    this.data = data;
  }
  get() {
    return this.data;
  }
}

const MOST_RECENT_CHUNK_ID = new Singleton();

export { MOST_RECENT_CHUNK_ID };

// ////////////// actual actions

export const EVALUATION_RESULTS = {};

export function setConsoleLanguage(language) {
  return {
    type: "SET_CONSOLE_LANGUAGE",
    language
  };
}

export function changeConsoleElement({
  historyType,
  content,
  historyId = historyIdGen.nextId(),
  level,
  language,
  actionType = "ADD_TO_CONSOLE"
}) {
  let consoleContent;
  EVALUATION_RESULTS[historyId] = content;

  if (historyType === "CONSOLE_OUTPUT" || historyType === "FETCH_CELL_INFO") {
    consoleContent = "";
  } else {
    consoleContent = content;
  }
  const action = {
    type: actionType,
    historyType,
    content: consoleContent,
    historyId,
    level,
    language,
    lastRan: Date.now()
  };
  if (actionType === "UPDATE_CONSOLE_ENTRY") delete action.historyType;
  return action;
}

export function addToConsole({
  historyType,
  content,
  historyId,
  level,
  language
}) {
  return changeConsoleElement({
    historyType,
    content,
    historyId,
    level,
    language,
    actionType: "ADD_TO_CONSOLE"
  });
}

export function updateConsoleEntry({ content, historyId, level, language }) {
  return changeConsoleElement({
    content,
    historyId,
    level,
    language,
    actionType: "UPDATE_CONSOLE_ENTRY"
  });
}

export function updateUserVariables() {
  return {
    type: "UPDATE_USER_VARIABLES",
    userDefinedVarNames: getUserDefinedVariablesFromWindow()
  };
}

export function updateConsoleText(consoleText) {
  return {
    type: "UPDATE_CONSOLE_TEXT",
    consoleText
  };
}

export function consoleHistoryStepBack(consoleCursorDelta) {
  return {
    type: "CONSOLE_HISTORY_MOVE",
    consoleCursorDelta
  };
}

export function evalConsoleInput(consoleText) {
  return (dispatch, getState) => {
    const state = getState();
    // const code = state.consoleText
    // exit if there is no code in the console to  eval
    if (!consoleText) {
      return undefined;
    }
    const evalLanguageId = state.languageLastUsed;

    dispatch({ type: "CLEAR_CONSOLE_TEXT_CACHE" });
    dispatch({ type: "RESET_HISTORY_CURSOR" });
    addToEvaluationQueue({
      chunkType: evalLanguageId,
      chunkId: undefined,
      chunkContent: consoleText,
      evalFlags: ""
    });
    dispatch(updateConsoleText(""));
    return Promise.resolve();
  };
}

function evaluateCode(code, language, state, evalId) {
  return dispatch => {
    const updateCellAfterEvaluation = (output, evalStatus) => {
      const cellProperties = { rendered: true };
      if (evalStatus === "ERROR") {
        cellProperties.evalStatus = evalStatus;
        sendStatusResponseToEditor("ERROR", evalId);
      } else {
        sendStatusResponseToEditor("SUCCESS", evalId);
      }
      if (output instanceof Error) {
        dispatch(
          addToConsole({
            historyType: "CONSOLE_OUTPUT",
            content: output,
            level: "error"
          })
        );
      } else {
        dispatch(
          addToConsole({
            historyType: "CONSOLE_OUTPUT",
            content: output
          })
        );
      }
      dispatch(updateUserVariables());
    };

    const messageCallback = msg => {
      dispatch(
        addToConsole({
          historyType: "CONSOLE_MESSAGE",
          content: msg,
          level: "log"
        })
      );
    };

    return ensureLanguageAvailable(language, state, evalId, dispatch)
      .then(languageEvaluator => {
        // here let's addToConsole
        dispatch(
          addToConsole({
            historyType: "CONSOLE_INPUT",
            content: code,
            language
          })
        );
        return runCodeWithLanguage(languageEvaluator, code, messageCallback);
      })
      .then(
        output => updateCellAfterEvaluation(output),
        output => updateCellAfterEvaluation(output, "ERROR")
      );
  };
}

// FIXME use evalFlags for something real
export function evaluateText(
  evalText,
  evalType,
  evalFlags, // eslint-disable-line
  chunkId = null,
  evalId
) {
  // allowed types:
  // md
  return (dispatch, getState) => {
    // exit if there is no code to eval or no eval type
    // if (!evalText || !evalType) { return undefined }
    // FIXME: we need to deprecate side effects ASAP. They don't serve a purpose
    // in the direct jsmd editing paradigm.

    MOST_RECENT_CHUNK_ID.set(chunkId);
    const sideEffect = document.getElementById(
      `side-effect-target-${MOST_RECENT_CHUNK_ID.get()}`
    );
    if (sideEffect) {
      sideEffect.innerText = null;
    }
    const state = getState();
    if (evalType === "fetch") {
      return dispatch(evaluateFetchText(evalText, evalId));
    } else if (evalType === "plugin") {
      return dispatch(evaluateLanguagePlugin(evalText, evalId));
    } else if (
      Object.keys(state.loadedLanguages).includes(evalType) ||
      Object.keys(state.languageDefinitions).includes(evalType)
    ) {
      return dispatch(evaluateCode(evalText, evalType, state, evalId));
    } else if (NONCODE_EVAL_TYPES.includes(evalType) || evalType === "") {
      sendStatusResponseToEditor("SUCCESS", evalId);
    } else {
      dispatch(
        addToConsole({
          content: evalText,
          historyType: "CONSOLE_INPUT",
          language: evalType
        })
      );
      dispatch(
        addToConsole({
          content: new Error(`eval type ${evalType} is not defined`),
          historyType: "CONSOLE_OUTPUT",
          level: "error"
        })
      );
      sendStatusResponseToEditor("ERROR", evalId);
    }
    return Promise.resolve();
  };
}

export function saveEnvironment(updateObj, update) {
  return {
    type: "SAVE_ENVIRONMENT",
    updateObj,
    update
  };
}
