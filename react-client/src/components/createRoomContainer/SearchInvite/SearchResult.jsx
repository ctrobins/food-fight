import React from 'react';

class SearchResult extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div>
        <div className="search-result">
          <p className="user-search-email">
            {this.props.user.email}
          </p>
          <button
            type="button"
            className={`button is-small ${this.props.added ? '' : 'is-info'}`}
            disabled={this.props.added}
            onClick={() => this.props.addCombatant(this.props.user.email)}
          >
            {this.props.added ? 'Added' : 'Add'}
          </button>
        </div>
      </div>
    )
  }
}

export default SearchResult;