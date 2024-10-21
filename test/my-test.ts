import { expect } from "chai";
import hre from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Lock", function () {
  // The loadFixture helper in the Hardhat Network Helpers fixes both of these problems.
  // This helper receives a fixture, a function that sets up the chain to some desired state.
  // The first time loadFixture is called, the fixture is executed. But the second time, instead of
  // executing the fixture again, loadFixture will reset the state of the network to the point
  // where it was right after the fixture was executed. This is faster, and it undoes any state
  // changes done by the previous test.

  async function deployOneYearLockFixture() {
    const ONE_GWEI = 1_000_000_000;
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;

    const lockedAmount = ONE_GWEI;
    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const lock = await hre.ethers.deployContract("Lock", [unlockTime], {
      value: lockedAmount,
    });

    return { lock, unlockTime, lockedAmount, owner, otherAccount };
  }

  it("Should set the right unlockTime", async function () {
    const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

    // we check that the value returned by the unlockTime() getter in the contract matches
    // the value that we used when we deployed it.
    expect(await lock.unlockTime()).to.equal(unlockTime);
  });

  it("Should set the right owner", async function () {
    const { lock, owner } = await loadFixture(deployOneYearLockFixture);

    expect(await lock.owner()).to.equal(owner.address);
  });

  it("Should transfer the funds to the owner", async function () {
    const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

    await time.increaseTo(unlockTime);
    await lock.withdraw();
  });

  it("Should emit a Withdrawal event", async function () {
    const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

    await time.increaseTo(unlockTime);
    await expect(lock.withdraw()).to.emit(lock, "Withdrawal");
  });

  it("Should revert if lockTime is not in the future", async function () {
    const currentTime = await time.latest();

    await expect(
      hre.ethers.deployContract("Lock", [currentTime], {
        value: 1,
      })
    ).to.be.revertedWith("Unlock time should be in the future");
  });

  /**
   * Test a function that reverts: above tests a read-only function that can be called without
   * paying a fee and without any risk. Other functions like withdraw can modify the state of
   * the contract. This means that we want some pre-conditions to be met for this function to
   * be called successfully. If you look at its first lines you'll see a couple of require checks for that purpose
   */
  it("Should revert with the right message if called too early", async function () {
    const { lock } = await loadFixture(deployOneYearLockFixture);

    // Notice that in the previous test we wrote expect(await ...) but now we are doing await expect(...). In the first case we were
    // comparing two values in a synchronous way; the inner await is just there to wait for the value to be retrieved. In the second case,
    // the whole assertion is async because it has to wait until the transaction is mined. This means that the expect call returns a promise
    // that we have to await.
    await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");
    // The .to.be.revertedWith matcher is not part of Chai itself; instead, it’s added by the Hardhat Chai Matchers plugin,
    // which is included in the sample project we are using.
  });

  it("Should revert with the right error if called from unauthorized account", async function () {
    const { lock, unlockTime, otherAccount } = await loadFixture(
      deployOneYearLockFixture
    );

    await time.increaseTo(unlockTime);
    await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
      "You aren't the owner"
    );
  });
});
