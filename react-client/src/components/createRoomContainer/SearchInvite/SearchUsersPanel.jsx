import React from 'react';
import validator from 'validator';
import api from '../../../api';
import SearchResult from './SearchResult.jsx';

class SearchUsersPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      query: '',
      results: [],
      searching: false,
      searchedQuery: '',
      inviteStatus: '',
      invitedEmail: '',
    };
    this.searchTimer = null;
    this.searchRequest = 0;
    this.enterQuery = this.enterQuery.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.sendInvite = this.sendInvite.bind(this);
  }

  componentWillUnmount() {
    clearTimeout(this.searchTimer);
  }

  enterQuery(e) {
    const query = e.target.value;
    this.setState({
      query,
      inviteStatus: '',
      invitedEmail: '',
    });
    clearTimeout(this.searchTimer);
    const trimmed = query.trim();
    if (!trimmed) {
      this.searchRequest += 1;
      this.setState({
        results: [],
        searching: false,
        searchedQuery: '',
      });
      return;
    }
    this.searchTimer = setTimeout(() => this.search(trimmed), 250);
  }

  search(query, after) {
    const requestId = this.searchRequest + 1;
    this.searchRequest = requestId;
    this.setState({ searching: true });
    api.post('/searchUsers', { query })
      .then((res) => {
        if (requestId !== this.searchRequest) {
          return;
        }
        this.setState({
          results: Array.isArray(res.data) ? res.data : [],
          searching: false,
          searchedQuery: query,
        }, () => {
          if (typeof after === 'function') {
            after();
          }
        });
      })
      .catch(() => {
        if (requestId !== this.searchRequest) {
          return;
        }
        this.setState({
          results: [],
          searching: false,
          searchedQuery: query,
        });
      });
  }

  exactMatch() {
    const query = this.state.searchedQuery.trim().toLowerCase();
    return this.state.results.find((user) => user.email.toLowerCase() === query);
  }

  canInvite() {
    const query = this.state.query.trim();
    return this.state.searchedQuery === query
      && !this.state.searching
      && validator.isEmail(query)
      && !this.exactMatch();
  }

  onKeyDown(e) {
    if (e.key !== 'Enter') {
      return;
    }
    e.preventDefault();
    const query = this.state.query.trim();
    if (!query) {
      return;
    }
    clearTimeout(this.searchTimer);
    const chooseMatch = () => {
      const exact = this.exactMatch();
      if (exact) {
        this.props.addCombatant(exact.email);
        return;
      }
      if (this.canInvite()) {
        this.sendInvite();
      }
    };
    if (this.state.searchedQuery === query && !this.state.searching) {
      chooseMatch();
      return;
    }
    this.search(query, chooseMatch);
  }

  sendInvite() {
    const email = this.state.query.trim();
    if (!validator.isEmail(email) || this.state.inviteStatus === 'sending') {
      return;
    }
    this.setState({ inviteStatus: 'sending' });
    api.post('/api/signupEmail', { email })
      .then(() => {
        this.searchRequest += 1;
        this.setState({
          inviteStatus: 'sent',
          invitedEmail: email,
          query: '',
          results: [],
          searching: false,
          searchedQuery: '',
        });
      })
      .catch(() => {
        this.setState({ inviteStatus: 'error' });
      });
  }

  render() {
    const query = this.state.query.trim();
    const combatants = this.props.combatants || [];
    const showResults = this.state.searchedQuery === query && !this.state.searching;
    const showInvite = showResults && this.canInvite();
    const showEmpty = showResults && query && this.state.results.length === 0 && !showInvite;

    let status = null;
    if (this.state.inviteStatus === 'sent') {
      status = (
        <p className="fighter-status is-success">
          Invite sent to {this.state.invitedEmail}. They will get a link to sign up.
        </p>
      );
    } else if (this.state.inviteStatus === 'error') {
      status = (
        <p className="fighter-status is-danger">
          Could not send that invite. Try again.
        </p>
      );
    }

    return (
      <article className="notification fighter-panel">
        <p className="title is-4">Add Fighters</p>
        <p className="fighter-help">
          Search by email. Add someone who already has an account, or invite them to sign up.
        </p>
        <div className="field">
          <div className="control">
            <input
              type="text"
              className="input"
              placeholder="Search by email"
              autoComplete="off"
              value={this.state.query}
              onChange={this.enterQuery}
              onKeyDown={this.onKeyDown}
            />
          </div>
        </div>
        {status}
        <div className="fighter-results">
          {showResults ? this.state.results.map((user) => (
            <SearchResult
              key={user.email}
              user={user}
              added={combatants.includes(user.email)}
              addCombatant={this.props.addCombatant}
            />
          )) : null}
          {showInvite ? (
            <div className="search-result">
              <div>
                <p className="user-search-email">{query}</p>
                <p className="fighter-result-note">No account yet</p>
              </div>
              <button
                type="button"
                className="button is-info is-small"
                disabled={this.state.inviteStatus === 'sending'}
                onClick={this.sendInvite}
              >
                {this.state.inviteStatus === 'sending' ? 'Sending…' : 'Invite'}
              </button>
            </div>
          ) : null}
          {showEmpty ? <p className="fighter-result-note">No accounts matched that search.</p> : null}
        </div>
      </article>
    );
  }
}

export default SearchUsersPanel;
