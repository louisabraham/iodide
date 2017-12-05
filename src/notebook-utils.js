import {store} from './index.jsx'

function isCommandMode(){
    return store.getState().mode=='command' && viewModeIsEditor()
}

function isEditMode(){
    return store.getState().mode=='command'
}

function viewModeIsEditor(){
  return store.getState().viewMode ==='editor'
}

function viewModeIsPresentation(){
  return store.getState().viewMode === 'presentation'
}

function getSelectedCellId(){
  let cells = store.getState().cells
  let index = cells.findIndex((c)=>{return c.selected})
  if (index > -1) {
    return cells[index].id
  } else {
    return undefined // for now
  }
}

function getCellBelowSelectedId(){
  let cells = store.getState().cells
  let index = cells.findIndex((c)=>{return c.selected})
  if (0<=index && index<(cells.length-1)) {
    return cells[index+1].id
  } else {
    return undefined // for now
  }
}

function getCellAboveSelectedId(){
  let cells = store.getState().cells
  let index = cells.findIndex((c)=>{return c.selected})
  if (0<index && index<=(cells.length-1)) {
    return cells[index-1].id
  } else {
    return undefined // for now
  }
}




function prettyDate(time) {
  var date = new Date(time),
    diff = (((new Date()).getTime() - date.getTime()) / 1000),
    day_diff = Math.floor(diff / 86400);
  // return date for anything greater than a day
  if ( isNaN(day_diff) || day_diff < 0 || day_diff > 0 )
    { return date.getDate() + " " + date.toDateString().split(" ")[1]; }
  
  return day_diff == 0 && (
      diff < 60 && "just now" ||
      diff < 120 && "1 minute ago" ||
      diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
      diff < 7200 && "1 hour ago" ||
      diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
    day_diff == 1 && "Yesterday" ||
    day_diff < 7 && day_diff + " days ago" ||
    day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago"
  }

  function formatDateString(d) {
  var d = new Date(d)
  return d.toUTCString()
}

const compose = (...functions) => data =>
functions.reduceRight((value, func) => func(value), data)

function newCellID(cells) {
  var newID = cells.reduce( (maxId, cell) => {
    return Math.max(cell.id, maxId)
  }, -1) + 1
  return newID
}

function newCell(cells, cellType){
    var outputCollapseDefault;
  if (cellType=="dom" || cellType=="external scripts" || cellType=="dom"){
    outputCollapseDefault = "COLLAPSED"
    } else {outputCollapseDefault = "EXPANDED"}
  return {
    content:'',
    id: newCellID(cells),
    cellType: cellType,
    value: undefined,
    rendered: false,
    selected: false,
    executionStatus: " ",
    evalStatus: undefined,
    // dependencies: [newDependency([], 'js')],
    // evaluationOld set to true if the content of the editor changes from whatever
    // produced the most recent output value
    evaluationOld: true,
    // these track the collapsed state of input and outputs
    // must be one of "COLLAPSED" "SCROLLABLE" "EXPANDED"
    collapseEditViewInput: "EXPANDED",
    collapseEditViewOutput: outputCollapseDefault,
    collapsePresentationViewInput: "COLLAPSED",
    collapsePresentationViewOutput: outputCollapseDefault,
  }
}

// function newDependency(dependencies, dependencyType) {
//   return {
//     status: undefined, // unloaded.
//     statusExplanation: undefined,
//     dependencyType: 'js',
//     src: undefined,
//     id: newCellID(dependencies)
//   }
// }

function addCell(cells, cellType='javascript') {
  // mutates state.cells.
  cells.push(newCell(cells, cellType))
}

function updateCell(cells, cellID, options) {
  // mutates state.cells.
  if (cellID === undefined || options === undefined) {
    throw new ValueError('updateCell requires a cellID and options. You provided id:' + cellID +' and options:' + options)
  } else {
    var cell = getCellById(cells, cellID)
    Object.keys(options).forEach((k)=>{
      cell[k] = options[k]
    })
  }
}

function blankState(){
  var initialState =  {
    title: undefined,
    cells: [],
    declaredProperties:{},
    lastValue: undefined,
    lastSaved: undefined,
    mode: 'command', // command, edit
    viewMode: 'editor', // editor, presentation
    sidePaneMode: undefined,
    history:[],
    externalScripts:[],
    executionNumber: 1
  }
  return initialState
}

function newNotebook(){
  var initialState = blankState()
  //initialState.cells.push(newCell(initialState.cells, 'javascript'))
  addCell(initialState.cells, 'javascript')
  selectCell(initialState.cells, initialState.cells[0].id)
  return initialState
}

function changeTitle(state, title) {
  state.title = title
}

function getCellById(cells, cellID) {
  // returns a reference to the cell.
  var thisCellIndex = cells.findIndex((c)=> c.id == cellID)
  var thisCell = cells[thisCellIndex]
  return thisCell
}

function selectCell(cells, cellID){
  cells.forEach((c)=>c.selected=false) // unselect all cells first.
  updateCell(cells, cellID, {selected: true})
}


function moveCell(cells, cellID, dir) {
  
    var _cells = cells.slice()
    var index = _cells.findIndex(c=>c.id===cellID);
  
    var moveIndex, moveCondition
    if (dir==='up') {
      moveIndex = -1
      moveCondition = index > 0
    } else {
      moveIndex = 1
      moveCondition = index < cells.length-1
    }
    if (moveCondition) {
      var elem = _cells[index+moveIndex];
      _cells[index+moveIndex] = _cells[index]
      _cells[index] = elem
    } 
    return _cells
  }

export {
  blankState, 
  changeTitle,
  newNotebook, 
  newCell,
  addCell,
  selectCell,
  moveCell,
  prettyDate,
  formatDateString,
  getCellById,
  newDependency,
  getSelectedCellId,
  getCellBelowSelectedId, getCellAboveSelectedId,
  isCommandMode,
  isEditMode,
  viewModeIsEditor, viewModeIsPresentation,
}