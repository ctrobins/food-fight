import React from 'react';
import SearchResult from './SearchResult.jsx';
import InviteUsers from './InviteUsers.jsx';

class SearchUsersPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      query: '',
      hasSearched: false,
    }

    this.enterQuery = this.enterQuery.bind(this);
    this.search = this.search.bind(this);
  }

  search() {
    this.setState({ hasSearched: true });
    this.props.searchUsers(this.state.query);
  }

  enterQuery(e) {
    this.setState({
      query: e.target.value,
    });
  }

  render() {
    let usersFound = null;
    if (this.props.foundUsers.length) {
      usersFound = this.props.foundUsers.map((user) => (
        <SearchResult
          key={user.email}
          user={user}
          addCombatant={this.props.addCombatant} />
      ));
    } else if (this.state.hasSearched) {
      usersFound = <p>No accounts matched that search.</p>;
    }

    return (
      <div>
        <article className="notification fighter-panel">
          <p className="title is-4">Find Fighters</p>
          <p className="fighter-help">Search for someone who already has an account, then add them to the arena.</p>
          <div className="field has-addons">
            <div className="control is-expanded">
              <input
                type="email"
                className="input"
                placeholder="Email"
                value={this.state.query}
                onChange={this.enterQuery} />
            </div>
            <div className="control">
              <a
                className="button is-info"
                onClick={this.search}>
                Search
              </a>
            </div>
          </div>
          <div className="fighter-results">
            {usersFound}
          </div>
        </article>
        <article className="notification fighter-panel">
          <InviteUsers />
        </article>
      </div>
    );
  }
}

export default SearchUsersPanel;
