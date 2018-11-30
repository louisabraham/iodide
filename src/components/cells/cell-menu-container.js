import React from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import PropTypes from 'prop-types'
import Tooltip from '@material-ui/core/Tooltip'
import Menu from '@material-ui/core/Menu'
import ArrowDropDown from '@material-ui/icons/ArrowDropDown'
import CellMenu from './cell-menu'

import * as actions from '../../actions/actions'
import { getCellById } from '../../tools/notebook-utils'
import { cellTypeToJsmdMap } from '../../tools/jsmd-tools'


export class CellMenuContainerUnconnected extends React.Component {
  static propTypes = {
    label: PropTypes.string.isRequired,
    cellId: PropTypes.number.isRequired,
    skipInRunAll: PropTypes.bool.isRequired,
  }

  constructor(props) {
    super(props)
    this.state = {
      anchorElement: null,
    }
    this.handleClick = this.handleClick.bind(this)
    this.handleIconButtonClose = this.handleIconButtonClose.bind(this)
  }

  handleClick(event) {
    this.setState({ anchorElement: event.currentTarget })
  }

  handleIconButtonClose() {
    this.setState({ anchorElement: null })
  }

  render() {
    const { anchorElement } = this.state
    const skipInRunAllIndicator = (
      this.props.skipInRunAll ?
        (
          <Tooltip
            classes={{ tooltip: 'iodide-tooltip' }}
            placement="bottom"
            title="Cell skipped during run all"
          >
            {
              <div className="warning-pill">skip</div>
            }
          </Tooltip>
        ) :
        ''
    )

    return (
      <div className="cell-menu-container">
        <Tooltip
          classes={{ tooltip: 'iodide-tooltip' }}
          placement="bottom"
          title="Cell Settings"
        >
          <div>
            <Menu
              id="cell-menu"
              anchorEl={this.state.anchorElement}
              open={Boolean(anchorElement)}
              onClose={this.handleIconButtonClose}
              anchorReference="anchorEl"
              transitionDuration={70}
              getContentAnchorEl={null}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              <CellMenu cellId={this.props.cellId} menuLabel={this.props.label} />
            </Menu>
            <div
              className="cell-type-label"
              aria-owns={anchorElement ? 'cell-menu' : null}
              aria-haspopup="true"
              onClick={this.handleClick}
            >
              <ArrowDropDown style={{ fontSize: 20 }} />
              {this.props.label}

            </div>
          </div>
        </Tooltip>
        <div className="cell-status-indicators">{skipInRunAllIndicator}</div>
      </div>
    )
  }
}


function mapStateToProps(state, ownProps) {
  const { cellId } = ownProps
  const cell = getCellById(state.cells, cellId)
  const label = cell.cellType === 'code' ? cell.language : cellTypeToJsmdMap.get(cell.cellType)
  return {
    label,
    skipInRunAll: cell.skipInRunAll,
  }
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CellMenuContainerUnconnected)