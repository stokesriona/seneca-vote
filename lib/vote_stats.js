const Assert = require('assert-plus')
const Vote = require('./vote_entity')
const groupBy = require('lodash.groupby')
const { countMatching } = require('./utils')

class VoteStats {
  static async forPoll(args, ctx, opts = {}) {
    const current_votes = await currentVotesForPoll(args, ctx)

    const num_upvotes = countMatching({ type: Vote.TYPE_UP() }, current_votes)
    const num_downvotes = countMatching({ type: Vote.TYPE_DOWN() }, current_votes)
    const num_total = num_upvotes - num_downvotes

    return VoteStats.Shapes.stats({ num_upvotes, num_downvotes, num_total })


    function currentVotesForPoll(args, ctx) {
      Assert.object(ctx, 'ctx')
      const seneca = ctx.seneca

      Assert.object(args, 'args')
      const poll_id = args.poll_id
      const vote_kind = args.vote_kind
      const vote_code = args.vote_code

      return seneca.make('sys/vote')
        .list$({ poll_id, kind: vote_kind, code: vote_code })
        .then(groupVotesByVoter)
        .then(votes_by_voter => {
          return votes_by_voter.map(votes => {
            Assert.array(votes, 'votes')
            Assert(votes.length > 0, 'votes.length')

            const [actual_vote,] = votes.sort(desc(byDateOfVote))

            return actual_vote
          })
        })
    }

    function groupVotesByVoter(votes) {
      Assert.array(votes, 'votes')

      const groups = groupBy(votes, byVoter)

      return Object.values(groups)
    }

    function byVoter(vote) {
      Assert.object(vote, 'vote')

      const voter_id = vote.voter_id
      const voter_type = vote.voter_type

      return [voter_id, voter_type].join('.')
    }

    function byDateOfVote(vote1, vote2) {
      Assert.object(vote1, 'vote1')
      Assert.object(vote2, 'vote2')

      const voted_at1 = vote1.created_at
      const voted_at2 = vote2.created_at

      return voted_at1.getTime() - voted_at2.getTime()
    }

    function desc(cmp) {
      return (x, y) => -1 * cmp(x, y)
    }
  }
}

VoteStats.Shapes = class {
  static stats(data) {
    Assert.object(data, 'data')
    Assert.number(data.num_upvotes, 'data.num_upvotes')
    Assert.number(data.num_downvotes, 'data.num_downvotes')
    Assert.number(data.num_total, 'data.num_total')

    return data
  }
}

module.exports = VoteStats